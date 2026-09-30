import { prisma } from "../lib/db";
import { morphoClient } from "../lib/graphql/client";
import {
  GET_LIQUIDATION_TRANSACTIONS,
  type LiquidationTransactionsResponse,
  type LiquidationTransaction,
  type LiquidationAsset,
} from "../lib/graphql/queries";

const BATCH_SIZE = 500;
const API_DELAY_MS = 200;
// A hung request must not hold the function past its cap (the time budget
// below is only checked between pages). A timeout throws, failing the step.
const REQUEST_TIMEOUT_MS = 30_000;
// The Morpho API rejects skip > 10,000, so MAX_PAGES * BATCH_SIZE must stay
// within 10,500 (last page requested at skip 9,500).
const MAX_PAGES = 20;
// Stop paging after this long; the rest is picked up by the next run. Keeps the
// step well inside the collect-market-data 900s cap alongside allocations.
const TIME_BUDGET_MS = 180_000;
// Re-read this much history below the newest stored row so late-indexed events
// are not missed (duplicates are skipped by the unique key).
const LOOKBACK_SEC = 60 * 60;
// Floor used only when the table is empty.
const EMPTY_TABLE_START_DAYS = 30;

function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [liquidations] ${message}`);
}

function logError(message: string, error?: unknown) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [liquidations] ERROR: ${message}`, error ?? "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Collect liquidation transactions from the Morpho API.
 *
 * Pages OLDEST-first from the newest stored liquidation (minus a lookback), so
 * the stored history never has holes: if a run hits its page/time budget, the
 * next run resumes from where this one stopped. This is how a backlog (e.g. the
 * 2026-07-29 → 2026-09-30 outage) catches up over one or more runs. Inserts are
 * idempotent via createMany skipDuplicates on (txHash, marketUniqueKey, borrower).
 *
 * Fetch and write errors propagate — callers must treat a throw as a failed run.
 */
export async function collectLiquidations(): Promise<{
  fetched: number;
  stored: number;
  unpriced: number;
  skipped: number;
  fromTimestamp: string;
  backlog: number;
}> {
  const startedAt = Date.now();
  let fetched = 0;
  let stored = 0;
  let unpriced = 0;
  let skipped = 0;
  let skip = 0;
  let countTotal = 0;

  const newest = await prisma.liquidation.aggregate({ _max: { timestamp: true } });
  const newestSec = newest._max.timestamp
    ? Math.floor(newest._max.timestamp.getTime() / 1000)
    : null;
  const timestampGte =
    newestSec !== null
      ? newestSec - LOOKBACK_SEC
      : Math.floor(startedAt / 1000) - EMPTY_TABLE_START_DAYS * 86400;
  const fromTimestamp = new Date(timestampGte * 1000).toISOString();

  log(`Starting liquidation collection from ${fromTimestamp}...`);

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await morphoClient.request<LiquidationTransactionsResponse>({
      document: GET_LIQUIDATION_TRANSACTIONS,
      variables: { first: BATCH_SIZE, skip, timestampGte },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const { items, pageInfo } = response.marketTransactions;
    countTotal = pageInfo.countTotal;

    if (items.length === 0) break;
    fetched += items.length;

    const rows = [];
    for (const tx of items) {
      const row = toLiquidationRow(tx);
      if (!row) {
        skipped++;
        continue;
      }
      if (row.unpriced) unpriced++;
      rows.push(row.data);
    }

    if (rows.length === 0) {
      // A full page we cannot map means the API shape changed — fail loud.
      throw new Error(
        `Liquidations page ${page + 1}: none of ${items.length} items could be mapped`
      );
    }

    const result = await prisma.liquidation.createMany({ data: rows, skipDuplicates: true });
    stored += result.count;

    log(`  Page ${page + 1}: ${items.length} fetched, ${result.count} new`);

    skip += BATCH_SIZE;
    if (skip >= countTotal) break;
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      log("Time budget reached; remaining backlog continues next run.");
      break;
    }
    await sleep(API_DELAY_MS);
  }

  const backlog = Math.max(0, countTotal - skip);
  log(
    `Liquidation collection complete: ${fetched} fetched, ${stored} stored, ` +
      `${unpriced} unpriced, ${skipped} skipped, ${backlog} left for next run`
  );
  return { fetched, stored, unpriced, skipped, fromTimestamp, backlog };
}

/** Raw token amount → USD. Null when the asset has no price. */
function toUsd(raw: number | string, asset: LiquidationAsset | null): number | null {
  if (!asset) return null;
  const usd = asset.price?.usd;
  if (usd == null || !Number.isFinite(usd)) return null;
  const value = (Number(raw) / 10 ** asset.decimals) * usd;
  return Number.isFinite(value) ? value : null;
}

function toLiquidationRow(tx: LiquidationTransaction) {
  const market = tx.market;
  const data = tx.data;
  if (!market?.marketId || !data?.liquidator || !tx.user?.address) return null;

  const repaidAssetsUsd = toUsd(data.repaidAssets, market.loanAsset);
  const badDebtAssetsUsd = toUsd(data.badDebtAssets, market.loanAsset);
  const seizedAssetsUsd = toUsd(data.seizedAssets, market.collateralAsset);

  return {
    // Unpriced legs are stored as 0 (columns are non-null), matching the old
    // `?? 0` behaviour; the count is surfaced in the run summary.
    unpriced: repaidAssetsUsd === null || seizedAssetsUsd === null,
    data: {
      txHash: tx.txHash,
      timestamp: new Date(Number(tx.timestamp) * 1000),
      marketUniqueKey: market.marketId,
      borrower: tx.user.address,
      liquidator: data.liquidator,
      repaidAssetsUsd: repaidAssetsUsd ?? 0,
      seizedAssetsUsd: seizedAssetsUsd ?? 0,
      badDebtAssetsUsd: badDebtAssetsUsd ?? 0,
    },
  };
}

// CLI entry point
async function main() {
  try {
    await collectLiquidations();
    const totalInDb = await prisma.liquidation.count();
    log(`Database total: ${totalInDb} liquidation records`);
    process.exit(0);
  } catch (error) {
    logError("Fatal error", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = require.main === module;
if (isDirectRun) {
  main();
}

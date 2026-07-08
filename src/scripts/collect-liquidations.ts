import { prisma } from "../lib/db";
import { morphoClient } from "../lib/graphql/client";
import {
  GET_LIQUIDATION_TRANSACTIONS,
  type LiquidationTransactionsResponse,
  type LiquidationTransaction,
} from "../lib/graphql/queries";

const BATCH_SIZE = 100;
const API_DELAY_MS = 200;
const MAX_PAGES = 50; // Safety limit

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
 * Collect liquidation transactions from Morpho API.
 * Paginates most-recent-first, stops when reaching already-stored records.
 */
export async function collectLiquidations(): Promise<{
  fetched: number;
  stored: number;
  errors: number;
}> {
  let fetched = 0;
  let stored = 0;
  let errors = 0;
  let skip = 0;
  let shouldContinue = true;

  log("Starting liquidation collection...");

  for (let page = 0; page < MAX_PAGES && shouldContinue; page++) {
    try {
      const response = await morphoClient.request<LiquidationTransactionsResponse>(
        GET_LIQUIDATION_TRANSACTIONS,
        { first: BATCH_SIZE, skip }
      );

      const items = response.transactions.items;

      if (items.length === 0) {
        log("No more liquidation transactions found.");
        break;
      }

      fetched += items.length;
      let newInBatch = 0;

      for (const tx of items) {
        try {
          const result = await upsertLiquidation(tx);
          if (result === "created") {
            stored++;
            newInBatch++;
          }
        } catch (err) {
          errors++;
          if (errors <= 3) {
            logError(`Failed to upsert liquidation ${tx.hash}`, err);
          }
        }
      }

      log(`  Page ${page + 1}: ${items.length} fetched, ${newInBatch} new`);

      // If no new records in this batch, we've caught up
      if (newInBatch === 0) {
        log("Reached already-stored records, stopping.");
        shouldContinue = false;
      } else {
        skip += BATCH_SIZE;
        await sleep(API_DELAY_MS);
      }
    } catch (err) {
      logError(`Failed to fetch liquidations page ${page + 1}`, err);
      errors++;
      shouldContinue = false;
    }
  }

  log(`Liquidation collection complete: ${fetched} fetched, ${stored} stored, ${errors} errors`);
  return { fetched, stored, errors };
}

async function upsertLiquidation(tx: LiquidationTransaction): Promise<"created" | "existing"> {
  const data = tx.data;
  if (!data?.market?.marketId) return "existing";

  const timestamp = new Date(Number(tx.timestamp) * 1000);
  const txHash = tx.hash;
  const marketUniqueKey = data.market.marketId;
  const borrower = tx.user.address;

  const existing = await prisma.liquidation.findUnique({
    where: {
      txHash_marketUniqueKey_borrower: {
        txHash,
        marketUniqueKey,
        borrower,
      },
    },
    select: { id: true },
  });

  if (existing) return "existing";

  await prisma.liquidation.create({
    data: {
      txHash,
      timestamp,
      marketUniqueKey,
      borrower,
      liquidator: data.liquidator,
      repaidAssetsUsd: data.repaidAssetsUsd ?? 0,
      seizedAssetsUsd: data.seizedAssetsUsd ?? 0,
      badDebtAssetsUsd: data.badDebtAssetsUsd ?? 0,
    },
  });

  return "created";
}

// CLI entry point
async function main() {
  try {
    const result = await collectLiquidations();
    const totalInDb = await prisma.liquidation.count();
    log(`Database total: ${totalInDb} liquidation records`);

    if (result.errors > 0) {
      process.exit(1);
    }
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

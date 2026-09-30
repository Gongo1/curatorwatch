/**
 * One-off backfill: Turtle VaultSnapshots for the 2026-09-18 → 2026-09-30 gap.
 *
 * earn.turtle.xyz started requiring an X-API-Key header on 2026-09-18 and the
 * collector sent none, so every Turtle row stopped getting snapshots (the 401
 * was swallowed). The collector is fixed in PR #66; this script fills the
 * missing days from Turtle's per-vault TVL history:
 *
 *   GET https://earn.turtle.xyz/v2/opportunities/{chainId}/{vaultAddress}/historical/tvl
 *       ?startDate=<ISO>&step=86400        (X-API-Key required, read-only)
 *
 * Each point is the time-weighted average USD TVL over a UTC day. Turtle only
 * has history for vaults it indexes; the rest come back with `data: []` and are
 * reported, not guessed.
 *
 * Rows match what collect-turtle-data.ts writes: totalAssets/totalSupply "0",
 * sharePrice 1, totalAssetsUsd = TVL. Turtle has no history of its estimated
 * APR, so apy/netApy/avgApy/avgNetApy carry the vault's last pre-gap values
 * forward (leaving them null would read as 0% in the weighted-APY charts).
 *
 * One row per vault per UTC day at the day bucket (00:00 UTC). A day that
 * already has any snapshot for the vault is skipped (idempotent).
 *
 * Targets: active Turtle rows with an on-chain address whose newest snapshot is
 * no older than --from minus 3 days (rows that were live when the feed broke).
 *
 * Usage (needs TURTLE_API_KEY in the environment):
 *   npm run backfill:turtle-tvl -- --fetch-only   # live API only, no DB access
 *   npm run backfill:turtle-tvl                   # dry run: reads DB, writes nothing
 *   npm run backfill:turtle-tvl -- --apply        # writes the missing rows
 * Options: --from=YYYY-MM-DD (default 2026-09-18), --limit=N (first N targets;
 * for quick --fetch-only checks, since the live feed has ~2k receipt tokens)
 */

import { prisma } from "../../lib/db";
import { fetchTurtleOpportunities, turtleApiKey } from "../../lib/turtle/client";

const HISTORY_URL = "https://earn.turtle.xyz/v2/opportunities";
const DEFAULT_FROM = "2026-09-18";
const TARGET_LOOKBACK_DAYS = 3;
const DAY_MS = 86_400_000;
const WRITE_BATCH = 500;
const RETRY_DELAY_MS = 2_000;
const CONCURRENCY = 6;

interface TvlPoint {
  timestamp: string;
  tvl: { native: string | null; usd: string | null };
}

interface TvlResponse {
  data: TvlPoint[] | null;
}

interface Apr {
  apy: number | null;
  netApy: number | null;
  avgApy: number | null;
  avgNetApy: number | null;
}

interface Target {
  id: string | null; // null in --fetch-only mode (no DB)
  name: string;
  address: string;
  chainId: number;
  apr: Apr;
  existingDays: Set<string>;
}

interface SnapshotRow extends Apr {
  vaultId: string;
  totalAssets: string;
  totalAssetsUsd: number;
  totalSupply: string;
  sharePrice: number;
  timestamp: Date;
}

const NO_APR: Apr = { apy: null, netApy: null, avgApy: null, avgNetApy: null };

function log(message: string) {
  console.log(`[${new Date().toISOString()}] [backfill:turtle-tvl] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const fromArg = args.find((a) => a.startsWith("--from="))?.split("=")[1];
  const from = new Date(`${fromArg ?? DEFAULT_FROM}T00:00:00Z`);
  if (Number.isNaN(from.getTime())) throw new Error(`Invalid --from=${fromArg}`);
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  const limit = limitArg ? Number(limitArg) : Infinity;
  return { apply: args.includes("--apply"), fetchOnly: args.includes("--fetch-only"), from, limit };
}

/** DB targets: active Turtle rows that were live when the feed broke. */
async function loadDbTargets(from: Date): Promise<Target[]> {
  const vaults = await prisma.vault.findMany({
    where: { dataSource: "turtle", active: true, onchainAddress: { not: null } },
    select: { id: true, name: true, onchainAddress: true, chainId: true },
  });

  const cutoff = new Date(from.getTime() - TARGET_LOOKBACK_DAYS * DAY_MS);
  const targets: Target[] = [];
  for (const v of vaults) {
    const snaps = await prisma.vaultSnapshot.findMany({
      where: { vaultId: v.id, timestamp: { gte: cutoff } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, apy: true, netApy: true, avgApy: true, avgNetApy: true },
    });
    if (snaps.length === 0) continue; // already stale before the gap
    // Last snapshot before the gap window supplies the carried-forward APR.
    const preGap = snaps.filter((s) => s.timestamp < from).pop() ?? snaps[0];
    targets.push({
      id: v.id,
      name: v.name,
      address: v.onchainAddress!,
      chainId: v.chainId,
      apr: {
        apy: preGap.apy,
        netApy: preGap.netApy,
        avgApy: preGap.avgApy,
        avgNetApy: preGap.avgNetApy,
      },
      existingDays: new Set(snaps.filter((s) => s.timestamp >= from).map((s) => dayKey(s.timestamp))),
    });
  }
  log(`${vaults.length} active Turtle rows with an on-chain address; ${targets.length} were live at the gap`);
  return targets;
}

/** --fetch-only targets: receipt tokens from the live Turtle feed (no DB). */
async function loadApiTargets(): Promise<Target[]> {
  const opps = await fetchTurtleOpportunities();
  const byKey = new Map<string, Target>();
  // Largest first, so --limit samples the vaults that matter most.
  for (const o of [...opps].sort((a, b) => b.tvl - a.tvl)) {
    const token = o.receiptToken;
    const chainId = Number(token?.chain.chainId);
    if (!token?.address || !Number.isInteger(chainId) || chainId < 1) continue;
    const key = `${chainId}:${token.address.toLowerCase()}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      id: null,
      name: o.name,
      address: token.address.toLowerCase(),
      chainId,
      apr: NO_APR,
      existingDays: new Set(),
    });
  }
  const targets = [...byKey.values()];
  log(`${opps.length} live Turtle opportunities; ${targets.length} distinct EVM receipt tokens`);
  return targets;
}

class VaultHistoryError extends Error {}

/**
 * Daily TVL for one vault. Returns null when Turtle rejects the address (400).
 * Retries once on 429/5xx, then throws VaultHistoryError (a per-vault failure,
 * e.g. Turtle's own query timeout on very large tokens). Any other status
 * throws a plain Error and aborts the run (e.g. 401 = key problem).
 */
async function fetchTvl(apiKey: string, target: Target, from: Date): Promise<TvlPoint[] | null> {
  const url =
    `${HISTORY_URL}/${target.chainId}/${target.address}/historical/tvl` +
    `?startDate=${from.toISOString()}&step=86400`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { Accept: "application/json", "X-API-Key": apiKey } });
    if (res.ok) {
      const body = (await res.json()) as TvlResponse;
      return body.data ?? [];
    }
    if (res.status === 400) return null;
    if (res.status === 429 || res.status >= 500) {
      if (attempt === 1) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new VaultHistoryError(`${res.status} for ${target.chainId}:${target.address}`);
    }
    throw new Error(`Turtle history ${res.status} for ${target.chainId}:${target.address}`);
  }
}

function toRows(target: Target, points: TvlPoint[]): SnapshotRow[] {
  const rows: SnapshotRow[] = [];
  for (const p of points) {
    const usd = p.tvl.usd == null ? NaN : Number(p.tvl.usd);
    if (!Number.isFinite(usd)) continue;
    const timestamp = new Date(p.timestamp);
    if (target.existingDays.has(dayKey(timestamp))) continue;
    rows.push({
      vaultId: target.id ?? "",
      totalAssets: "0",
      totalAssetsUsd: usd,
      totalSupply: "0",
      sharePrice: 1,
      ...target.apr,
      timestamp,
    });
  }
  return rows;
}

async function main() {
  const { apply, fetchOnly, from, limit } = parseArgs();
  const apiKey = turtleApiKey();
  const mode = fetchOnly ? "FETCH-ONLY (no DB)" : apply ? "APPLY" : "DRY RUN";
  log(`${mode}: from ${dayKey(from)}`);

  const targets = (fetchOnly ? await loadApiTargets() : await loadDbTargets(from)).slice(0, limit);

  let withHistory = 0;
  let rejected = 0;
  let rowsWritten = 0;
  let tvlCoveredUsd = 0;
  const noHistory: string[] = [];
  const failed: string[] = [];
  const pending: SnapshotRow[] = [];
  const allRows: SnapshotRow[] = [];

  const flush = async () => {
    const batch = pending.splice(0);
    if (apply && batch.length > 0) {
      const result = await prisma.vaultSnapshot.createMany({ data: batch });
      rowsWritten += result.count;
    }
  };

  const processTarget = async (target: Target) => {
    let points: TvlPoint[] | null;
    try {
      points = await fetchTvl(apiKey, target, from);
    } catch (error) {
      if (!(error instanceof VaultHistoryError)) throw error;
      failed.push(`${target.name} (${error.message})`);
      return;
    }
    if (points === null) {
      rejected++;
      return;
    }
    if (points.length === 0) {
      noHistory.push(`${target.name} (${target.chainId}:${target.address})`);
      return;
    }
    withHistory++;
    tvlCoveredUsd += Number(points[points.length - 1].tvl.usd ?? 0);
    const rows = toRows(target, points);
    pending.push(...rows);
    allRows.push(...rows);
    if (pending.length >= WRITE_BATCH) await flush();
  };

  // Turtle's history endpoint takes 2-9s per vault, so run a few in parallel.
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < targets.length) {
      await processTarget(targets[next++]);
      if (++done % 50 === 0) log(`  ${done}/${targets.length} vaults fetched`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await flush();

  const days = new Map<string, number>();
  for (const r of allRows) days.set(dayKey(r.timestamp), (days.get(dayKey(r.timestamp)) ?? 0) + 1);

  log(
    `Done: ${targets.length} targets, ${withHistory} with history ` +
      `(latest TVL $${(tvlCoveredUsd / 1e9).toFixed(2)}B), ${noHistory.length} without, ` +
      `${rejected} rejected addresses, ${failed.length} failed, ${allRows.length} rows ` +
      (apply ? `planned, ${rowsWritten} written` : "would be written")
  );
  log(`Rows per day: ${JSON.stringify(Object.fromEntries([...days].sort()))}`);
  if (noHistory.length > 0) {
    log(`No Turtle history (${noHistory.length}): ${noHistory.slice(0, 25).join("; ")}${noHistory.length > 25 ? "; ..." : ""}`);
  }
  if (allRows[0]) log(`Sample row: ${JSON.stringify(allRows[0])}`);
  if (failed.length > 0) {
    // Rows for every other vault are already written; a re-run retries only
    // the missing days. Exit non-zero so the gap is not silently left open.
    throw new Error(`Turtle history failed for ${failed.length} vault(s): ${failed.join("; ")}`);
  }
  if (targets.length > 0 && withHistory === 0) {
    throw new Error("Turtle returned no TVL history for any target vault");
  }
}

let exitCode = 0;
main()
  .catch((error) => {
    console.error(`[backfill:turtle-tvl] FATAL:`, error);
    exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(exitCode);
  });

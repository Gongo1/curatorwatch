/**
 * One-off backfill: Morpho V2 VaultSnapshots for the 2026-08-26 → 2026-09-30 gap.
 *
 * Morpho removed VaultV2.avgApy on 2026-08-26, so GET_VAULTS_V2_PAGINATED failed
 * and every V2 vault stopped getting snapshots (the collector swallowed the
 * error). The collector is fixed in PR #66; this script fills the missing days
 * from Morpho's own daily history (vaultV2s → historicalState, interval DAY).
 *
 * One row per vault per UTC day, stamped at the day bucket (00:00 UTC). A day
 * that already has any snapshot for the vault is skipped, so the script is
 * idempotent and never overlaps rows the fixed collector writes.
 *
 * Fields written: totalAssets, totalAssetsUsd, totalSupply, sharePrice,
 * avgNetApy (sanitized like createSnapshot). History has no liquidity or
 * instantaneous apy/netApy, so those stay null. avgApy stays null, the same as
 * the live collector writes since Morpho removed it.
 *
 * Targets: active Morpho V2 vaults (V2 = has risk snapshots, see
 * countTrackedVaults in collect-data.ts) whose newest snapshot is no older than
 * --from minus 3 days, i.e. vaults that were live when the collector broke, plus
 * vaults the fixed collector has created since.
 *
 * Usage:
 *   npm run backfill:morpho-v2 -- --fetch-only   # live API only, no DB access
 *   npm run backfill:morpho-v2                   # dry run: reads DB, writes nothing
 *   npm run backfill:morpho-v2 -- --apply        # writes the missing rows
 * Options: --from=YYYY-MM-DD (default 2026-08-27), --to=YYYY-MM-DD (default now)
 */

import { GraphQLClient, gql } from "graphql-request";
import { prisma } from "../../lib/db";
import { sanitizeApyForStorage } from "../../lib/utils/sanitize-apy";
import { MORPHO_CHAINS } from "../collect-data";

const MORPHO_API_URL = process.env.MORPHO_API_URL || "https://api.morpho.org/graphql";
const client = new GraphQLClient(MORPHO_API_URL);

const DEFAULT_FROM = "2026-08-27";
// 15 vaults x 5 DAY series over ~35 days costs ~750k of the API's 1M complexity cap.
const BATCH_SIZE = 15;
const API_DELAY_MS = 250;
const TARGET_LOOKBACK_DAYS = 3;
const DAY_MS = 86_400_000;

const GET_VAULT_V2_HISTORY = gql`
  query GetVaultV2History(
    $chainId: Int!
    $addresses: [String!]
    $options: TimeseriesOptions
    $first: Int!
  ) {
    vaultV2s(first: $first, where: { chainId_in: [$chainId], address_in: $addresses }) {
      items {
        address
        historicalState {
          sharePrice(options: $options) { x y }
          totalAssets(options: $options) { x y }
          totalAssetsUsd(options: $options) { x y }
          totalSupply(options: $options) { x y }
          avgNetApy(options: $options) { x y }
        }
      }
    }
  }
`;

const LIST_VAULT_V2_ADDRESSES = gql`
  query ListVaultV2Addresses($first: Int!, $skip: Int!, $chainId: Int!, $minTvl: Float!) {
    vaultV2s(
      first: $first
      skip: $skip
      orderBy: TotalAssetsUsd
      orderDirection: Desc
      where: { chainId_in: [$chainId], totalAssetsUsd_gte: $minTvl }
    ) {
      items {
        address
      }
    }
  }
`;

interface Point<T> {
  x: number;
  y: T | null;
}

interface VaultHistory {
  address: string;
  historicalState: {
    sharePrice: Point<number>[];
    totalAssets: Point<number | string>[];
    totalAssetsUsd: Point<number>[];
    totalSupply: Point<number | string>[];
    avgNetApy: Point<number>[];
  };
}

interface Target {
  id: string | null; // null in --fetch-only mode (no DB)
  address: string;
  chainId: number;
  existingDays: Set<string>;
}

interface SnapshotRow {
  vaultId: string;
  totalAssets: string;
  totalAssetsUsd: number;
  totalSupply: string;
  sharePrice: number;
  avgNetApy: number | null;
  timestamp: Date;
}

function log(message: string) {
  console.log(`[${new Date().toISOString()}] [backfill:morpho-v2] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const value = (name: string) =>
    args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const from = new Date(`${value("from") ?? DEFAULT_FROM}T00:00:00Z`);
  const toArg = value("to");
  const to = toArg ? new Date(`${toArg}T00:00:00Z`) : new Date();
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    throw new Error(`Invalid range: --from=${value("from")} --to=${toArg}`);
  }
  return {
    apply: args.includes("--apply"),
    fetchOnly: args.includes("--fetch-only"),
    from,
    to,
  };
}

/** DB targets: active V2 vaults that were live at (or created after) the gap. */
async function loadDbTargets(from: Date, to: Date): Promise<Target[]> {
  const vaults = await prisma.vault.findMany({
    where: { dataSource: "morpho", active: true, riskSnapshots: { some: {} } },
    select: { id: true, address: true, chainId: true },
  });
  const ids = vaults.map((v) => v.id);

  const newest = await prisma.vaultSnapshot.groupBy({
    by: ["vaultId"],
    where: { vaultId: { in: ids } },
    _max: { timestamp: true },
  });
  const cutoff = new Date(from.getTime() - TARGET_LOOKBACK_DAYS * DAY_MS);
  const live = new Set(
    newest.filter((n) => n._max.timestamp && n._max.timestamp >= cutoff).map((n) => n.vaultId)
  );

  const existing = await prisma.vaultSnapshot.findMany({
    where: { vaultId: { in: [...live] }, timestamp: { gte: from, lte: to } },
    select: { vaultId: true, timestamp: true },
  });
  const daysByVault = new Map<string, Set<string>>();
  for (const s of existing) {
    const set = daysByVault.get(s.vaultId) ?? new Set<string>();
    set.add(dayKey(s.timestamp));
    daysByVault.set(s.vaultId, set);
  }

  log(`${vaults.length} active V2 vaults in DB; ${live.size} were live at the gap`);
  return vaults
    .filter((v) => live.has(v.id))
    .map((v) => ({
      id: v.id,
      address: v.address,
      chainId: v.chainId,
      existingDays: daysByVault.get(v.id) ?? new Set<string>(),
    }));
}

/** --fetch-only targets: the live V2 list from the Morpho API (no DB). */
async function loadApiTargets(): Promise<Target[]> {
  const targets: Target[] = [];
  for (const chain of MORPHO_CHAINS) {
    for (let skip = 0; ; skip += 100) {
      const res = await client.request<{ vaultV2s: { items: { address: string }[] } }>(
        LIST_VAULT_V2_ADDRESSES,
        { first: 100, skip, chainId: chain.chainId, minTvl: chain.minTvlUsd }
      );
      for (const v of res.vaultV2s.items) {
        targets.push({ id: null, address: v.address, chainId: chain.chainId, existingDays: new Set() });
      }
      if (res.vaultV2s.items.length < 100) break;
      await sleep(API_DELAY_MS);
    }
  }
  log(`${targets.length} live V2 vaults from the Morpho API`);
  return targets;
}

/** Fetch DAY history for one batch (same chain). Throws on any API error. */
async function fetchHistory(
  chainId: number,
  addresses: string[],
  from: Date,
  to: Date
): Promise<Map<string, VaultHistory>> {
  const res = await client.request<{ vaultV2s: { items: VaultHistory[] } }>(
    GET_VAULT_V2_HISTORY,
    {
      chainId,
      addresses,
      first: addresses.length,
      options: {
        startTimestamp: Math.floor(from.getTime() / 1000),
        endTimestamp: Math.floor(to.getTime() / 1000),
        interval: "DAY",
      },
    }
  );
  return new Map(res.vaultV2s.items.map((v) => [v.address.toLowerCase(), v]));
}

/** Turn one vault's history into snapshot rows for the days it is missing. */
function toRows(target: Target, history: VaultHistory): SnapshotRow[] {
  const h = history.historicalState;
  const byX = <T>(points: Point<T>[]) => new Map(points.map((p) => [p.x, p.y]));
  const assets = byX(h.totalAssets);
  const supply = byX(h.totalSupply);
  const usd = byX(h.totalAssetsUsd);
  const netApy = byX(h.avgNetApy);

  const rows: SnapshotRow[] = [];
  for (const { x, y: sharePrice } of h.sharePrice) {
    const totalAssets = assets.get(x);
    const totalSupply = supply.get(x);
    const totalAssetsUsd = usd.get(x);
    // Skip incomplete buckets (e.g. before the vault existed) rather than guess.
    if (sharePrice == null || totalAssets == null || totalSupply == null || totalAssetsUsd == null) {
      continue;
    }
    const timestamp = new Date(x * 1000);
    if (target.existingDays.has(dayKey(timestamp))) continue;
    rows.push({
      vaultId: target.id ?? "",
      totalAssets: String(totalAssets),
      totalAssetsUsd,
      totalSupply: String(totalSupply),
      sharePrice,
      avgNetApy: sanitizeApyForStorage(netApy.get(x)),
      timestamp,
    });
  }
  return rows;
}

async function main() {
  const { apply, fetchOnly, from, to } = parseArgs();
  const mode = fetchOnly ? "FETCH-ONLY (no DB)" : apply ? "APPLY" : "DRY RUN";
  log(`${mode}: ${dayKey(from)} → ${to.toISOString()}`);

  const targets = fetchOnly ? await loadApiTargets() : await loadDbTargets(from, to);

  const byChain = new Map<number, Target[]>();
  for (const t of targets) {
    byChain.set(t.chainId, [...(byChain.get(t.chainId) ?? []), t]);
  }

  let fetchedVaults = 0;
  let missingFromApi = 0;
  let rowsPlanned = 0;
  let rowsWritten = 0;
  let sample: SnapshotRow | null = null;
  const missing: string[] = [];

  for (const [chainId, chainTargets] of byChain) {
    for (let i = 0; i < chainTargets.length; i += BATCH_SIZE) {
      const batch = chainTargets.slice(i, i + BATCH_SIZE);
      const histories = await fetchHistory(chainId, batch.map((t) => t.address), from, to);

      const rows: SnapshotRow[] = [];
      for (const target of batch) {
        const history = histories.get(target.address.toLowerCase());
        if (!history) {
          missingFromApi++;
          missing.push(`${chainId}:${target.address}`);
          continue;
        }
        fetchedVaults++;
        rows.push(...toRows(target, history));
      }
      rowsPlanned += rows.length;
      if (!sample && rows.length > 0) sample = rows[0];

      if (apply && rows.length > 0) {
        const result = await prisma.vaultSnapshot.createMany({ data: rows });
        rowsWritten += result.count;
      }
      await sleep(API_DELAY_MS);
    }
    log(`  chain ${chainId}: ${chainTargets.length} vaults done`);
  }

  log(
    `Done: ${targets.length} targets, ${fetchedVaults} with history, ` +
      `${missingFromApi} not returned by the API, ${rowsPlanned} rows ` +
      (apply ? `planned, ${rowsWritten} written` : "would be written")
  );
  if (missing.length > 0) log(`Not returned by the API: ${missing.join(", ")}`);
  if (sample) log(`Sample row: ${JSON.stringify(sample)}`);
  if (targets.length > 0 && fetchedVaults === 0) {
    throw new Error("Morpho API returned no history for any target vault");
  }
}

let exitCode = 0;
main()
  .catch((error) => {
    console.error(`[backfill:morpho-v2] FATAL:`, error);
    exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(exitCode);
  });

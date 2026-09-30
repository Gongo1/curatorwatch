/**
 * Upshift platform collection pipeline (P4 of the coverage roadmap).
 *
 * Ingests vaults from the Upshift platform (August Digital) with
 * platform-vs-curator modeling: `protocol: "upshift"` is the infrastructure,
 * the curator is the vault's STRATEGIST (RockawayX, Clearstar, Sentora, K3,
 * Gami, …) — exactly how Morpho vaults are attributed to their curators, not
 * to Morpho.
 *
 * Policy (mirrors the Euler pipeline):
 *  - Respect the platform's own listing: the pools endpoint returns only the
 *    vaults the app lists (Upshift hides wound-down/pre-launch vaults and
 *    cross-chain mirrors, and hidden rows include exact duplicates that
 *    would double count); of those, `status === "active"` only. Skipped
 *    non-active TVL is reported, never silent.
 *  - The platform reports no fees: existing fee values are left untouched
 *    (never overwritten with 0). A target-only APY is not stored as realized.
 *  - EVM chains our registry can name; Stellar/other-VM vaults skipped + reported.
 *  - $50k TVL floor. Strategist attribution required (matchCurator: existing
 *    rows first, else a clean `tc:<slug>` from the strategist name); vaults
 *    with no strategist are skipped + reported.
 *  - Cross-source guard (one active row per vault, never two):
 *      · an active non-Turtle row (Morpho, Euler, fund) owns the vault → skip;
 *      · an active Turtle row that the LIVE Turtle feed still lists owns it →
 *        skip (Turtle keeps refreshing it);
 *      · otherwise an existing Upshift row is refreshed, and a Turtle row for
 *        the same vault that the live feed no longer lists is retired
 *        (active=false) — it is a frozen duplicate;
 *      · a vault only in the live Turtle feed (no row yet) is left to Turtle.
 *    If the Turtle feed can't be read, every active Turtle row counts as live
 *    (skip, never double count) and the run reports an error.
 *  - Stale sweep: Upshift rows this run did not ingest (no longer listed,
 *    below the floor, non-active, unattributed, owned by another pipeline)
 *    are set active=false, so a vault never stays "live" on a frozen snapshot.
 */

import { prisma } from "../lib/db";
import {
  fetchUpshiftVaults,
  isEvmAddress,
  type UpshiftVault,
} from "../lib/upshift/client";
import { matchCurator } from "../lib/turtle/curator-matcher";
import { fetchTurtleOpportunities } from "../lib/turtle/client";
import { resolveChainId, canonicalChainName, getChainNameById } from "../lib/turtle/chain-mapper";
import { sanitizeApyPct } from "../lib/utils/sanitize-apy";
import { assessPhantom, type PhantomBaseline } from "../lib/data-quality/phantom";
import {
  fetchPhantomBaselines,
  finalizeCollection,
  recordSnapshotWritten,
} from "../lib/data-quality/maintenance";

const MIN_TVL_USD = 50_000;

export interface UpshiftCollectionResult {
  success: boolean;
  totalFetched: number;
  vaultsUpserted: number;
  snapshotsCreated: number;
  skippedInvisible: number;
  skippedInvisibleTvlUsd: number;
  skippedNonEvm: number;
  skippedNonEvmTvlUsd: number;
  skippedUnattributed: { name: string; tvl: number }[];
  crossSourceOverlaps: { name: string; tvl: number; address: string; source: string }[];
  deactivatedStale: number; // Upshift rows this run retired (see stale sweep)
  retiredTurtleDuplicates: number; // Turtle rows for Upshift vaults the live Turtle feed dropped
  errors: string[];
  duration: number;
}

function log(message: string) {
  console.log(`[${new Date().toISOString()}] [UPSHIFT] ${message}`);
}

function logError(message: string, error?: unknown) {
  console.error(`[${new Date().toISOString()}] [UPSHIFT] ERROR: ${message}`, error ?? "");
}

async function upsertUpshiftVault(
  vault: UpshiftVault,
  curatorId: string,
  baselines: Map<string, PhantomBaseline>
): Promise<{ upserted: boolean; skipped?: boolean; error?: string }> {
  try {
    const chainId = vault.chainId;
    const chainName = canonicalChainName(chainId);
    const addressLower = vault.address.toLowerCase();
    const tvlUsd = vault.tvlUsd;

    // A target-only APY is the strategist's target, not a realized yield.
    const estTotalAPR = vault.apyDisplay?.isTargetOnly ? null : sanitizeApyPct(vault.apy ?? null);
    const aprDecimal = estTotalAPR != null ? estTotalAPR / 100 : null;
    const sharePrice =
      typeof vault.sharePrice === "number" && Number.isFinite(vault.sharePrice) && vault.sharePrice > 0
        ? vault.sharePrice
        : 1;
    const assetDecimals = vault.depositAsset?.decimals;
    const totalAssets =
      typeof vault.tvl === "number" && Number.isFinite(vault.tvl) && vault.tvl >= 0 && assetDecimals != null
        ? vault.tvl.toFixed(assetDecimals).replace(".", "").replace(/^0+(?=\d)/, "")
        : "0";

    // No fee fields: the platform does not report fees, so existing values stay.
    const vaultFields = {
      name: vault.name,
      protocol: "upshift",
      curatorId,
      dataSource: "upshift" as const,
      opportunityType: "vault",
      chainId,
      chainName,
      onchainAddress: addressLower,
      onchainSymbol: vault.receiptSymbol ?? null,
      estTotalAPR,
      netAPR: estTotalAPR,
      active: true,
    };

    const existing = await prisma.vault.findUnique({
      where: { address: vault.address },
      select: { id: true, chainId: true },
    });
    if (existing && existing.chainId !== chainId) {
      log(`  ⚠ Address collision across chains, skipping: ${vault.address} (db chain ${existing.chainId}, api chain ${chainId})`);
      return { upserted: false, skipped: true };
    }

    const row = await prisma.vault.upsert({
      where: { address: vault.address },
      update: { ...vaultFields, updatedAt: new Date() },
      create: {
        address: vault.address,
        symbol: vault.receiptSymbol ?? vault.name,
        assetAddress: vault.depositAsset?.address ?? "unknown",
        assetSymbol: vault.depositAsset?.symbol ?? "UNKNOWN",
        assetDecimals: assetDecimals ?? 18,
        ...vaultFields,
      },
    });

    await prisma.vaultSnapshot.create({
      data: {
        vaultId: row.id,
        totalAssets,
        totalAssetsUsd: tvlUsd,
        totalSupply: vault.totalSupplyRaw ?? "0",
        sharePrice,
        apy: aprDecimal,
        netApy: aprDecimal,
        avgApy: aprDecimal,
        avgNetApy: aprDecimal,
      },
    });
    // Phantom test on the RAW source values (the stored APY is sanitized).
    const phantomReason = assessPhantom({
      apy: vault.apyDisplay?.isTargetOnly || vault.apy == null ? null : vault.apy / 100,
      sharePrice,
      assetSymbol: vault.depositAsset?.symbol ?? "UNKNOWN",
      totalAssets,
      totalSupply: vault.totalSupplyRaw ?? null,
      baseline: baselines.get(row.id) ?? null,
    });
    if (phantomReason) log(`  ⚠ Phantom accrual, not counted in totals: ${vault.name} (${phantomReason})`);
    await recordSnapshotWritten(row.id, phantomReason);

    return { upserted: true };
  } catch (error) {
    return {
      upserted: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function collectUpshiftData(): Promise<UpshiftCollectionResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  log("=".repeat(60));
  log("Starting Upshift data collection...");

  let totalFetched = 0;
  let vaultsUpserted = 0;
  let skippedInvisible = 0;
  let skippedInvisibleTvlUsd = 0;
  let skippedNonEvm = 0;
  let skippedNonEvmTvlUsd = 0;
  const skippedUnattributed: UpshiftCollectionResult["skippedUnattributed"] = [];
  const crossSourceOverlaps: UpshiftCollectionResult["crossSourceOverlaps"] = [];

  try {
    const vaults = await fetchUpshiftVaults();
    totalFetched = vaults.length;
    const phantomBaselines = await fetchPhantomBaselines("upshift");
    log(`Fetched ${vaults.length} vaults from the Upshift platform`);

    // Identities owned by other ACTIVE non-Turtle rows (Morpho/Euler real
    // addresses, fund onchainAddress). A retired row owns nothing.
    const foreign = await prisma.vault.findMany({
      where: { dataSource: { notIn: ["upshift", "turtle"] }, active: true },
      select: { address: true, onchainAddress: true, chainId: true, dataSource: true },
    });
    const foreignKeys = new Map<string, string>();
    for (const v of foreign) {
      foreignKeys.set(`${v.address.toLowerCase()}:${v.chainId}`, v.dataSource);
      if (v.onchainAddress) foreignKeys.set(`${v.onchainAddress}:${v.chainId}`, v.dataSource);
    }
    // Active Turtle rows by on-chain identity, and this pipeline's own rows.
    const turtleRows = new Map<string, { id: string; turtleId: string | null }>();
    for (const v of await prisma.vault.findMany({
      where: { dataSource: "turtle", active: true, onchainAddress: { not: null } },
      select: { id: true, turtleId: true, onchainAddress: true, chainId: true },
    })) {
      turtleRows.set(`${v.onchainAddress}:${v.chainId}`, { id: v.id, turtleId: v.turtleId });
    }
    const upshiftRows = await prisma.vault.findMany({
      where: { dataSource: "upshift" },
      select: { id: true, address: true, chainId: true, active: true },
    });
    const upshiftKeys = new Set(upshiftRows.map((v) => `${v.address.toLowerCase()}:${v.chainId}`));

    // Receipt tokens (addr:chainId) and opportunity ids the LIVE Turtle feed
    // lists. null = feed unreadable → every active Turtle row counts as live.
    let liveTurtle: Set<string> | null = null;
    try {
      const opportunities = await fetchTurtleOpportunities();
      liveTurtle = new Set<string>();
      for (const opp of opportunities) {
        liveTurtle.add(opp.id);
        const receipt = opp.receiptToken;
        if (!receipt?.address) continue;
        const chainId = resolveChainId(receipt.chain?.chainId, receipt.chain?.slug);
        if (chainId === null) continue;
        liveTurtle.add(`${receipt.address.toLowerCase()}:${chainId}`);
      }
    } catch (error) {
      const msg = `Turtle feed unavailable for the cross-source guard: ${error instanceof Error ? error.message : error}`;
      logError(msg);
      errors.push(msg);
    }

    /** Who owns this vault? `null` = Upshift ingests it (see header). */
    const retireTurtleIds = new Set<string>();
    const ownerOf = (key: string): string | null => {
      const other = foreignKeys.get(key);
      if (other) return other;
      const turtleRow = turtleRows.get(key);
      const turtleLive =
        turtleRow !== undefined &&
        (liveTurtle === null ||
          liveTurtle.has(key) ||
          (turtleRow.turtleId !== null && liveTurtle.has(turtleRow.turtleId)));
      if (turtleLive) return "turtle";
      if (!upshiftKeys.has(key) && liveTurtle?.has(key)) return "turtle (live feed)";
      if (turtleRow) retireTurtleIds.add(turtleRow.id); // frozen: the live feed dropped it
      return null;
    };
    const kept = new Set<string>(); // addr:chainId of every vault this run ingests

    for (const vault of vaults) {
      const tvlUsd = vault.tvlUsd;
      if (tvlUsd < MIN_TVL_USD) continue;

      if (vault.status !== "active") {
        skippedInvisible++;
        skippedInvisibleTvlUsd += tvlUsd;
        continue;
      }
      if (!isEvmAddress(vault.address) || getChainNameById(vault.chainId) === "Unknown") {
        skippedNonEvm++;
        skippedNonEvmTvlUsd += tvlUsd;
        continue;
      }

      const addressLower = vault.address.toLowerCase();
      const owner = ownerOf(`${addressLower}:${vault.chainId}`);
      if (owner) {
        crossSourceOverlaps.push({ name: vault.name, tvl: tvlUsd, address: addressLower, source: owner });
        continue;
      }

      const curatorId = vault.strategistName
        ? await matchCurator(vault.name, { name: vault.strategistName })
        : null;
      if (!curatorId) {
        skippedUnattributed.push({ name: vault.name, tvl: tvlUsd });
        continue;
      }

      kept.add(`${addressLower}:${vault.chainId}`);
      const result = await upsertUpshiftVault(vault, curatorId, phantomBaselines);
      if (result.upserted) {
        vaultsUpserted++;
      } else if (result.error) {
        errors.push(`${vault.name}: ${result.error}`);
        logError(`Failed to upsert ${vault.name}: ${result.error}`);
      }
    }

    // ── Stale sweep + frozen-duplicate retirement ───────────────────────────
    // Only reached after a successful, non-empty fetch (the client throws
    // otherwise), so a source outage can never retire live rows.
    const staleIds = upshiftRows
      .filter((v) => v.active && !kept.has(`${v.address.toLowerCase()}:${v.chainId}`))
      .map((v) => v.id);
    const deactivatedStale =
      staleIds.length > 0
        ? (await prisma.vault.updateMany({ where: { id: { in: staleIds } }, data: { active: false } })).count
        : 0;
    const retiredTurtleDuplicates =
      retireTurtleIds.size > 0
        ? (
            await prisma.vault.updateMany({
              where: { id: { in: [...retireTurtleIds] } },
              data: { active: false },
            })
          ).count
        : 0;

    // Totals hygiene: exclusion flags, then curator stats over counted vaults.
    const hygiene = await finalizeCollection();
    log(`  Exclusion flags changed: ${hygiene.changed} (${JSON.stringify(hygiene.excludedByReason)})`);

    const duration = Date.now() - startTime;
    log("-".repeat(60));
    log("Upshift collection completed!");
    log(`  Fetched: ${totalFetched}`);
    log(`  Upserted (visible, EVM, attributed, ≥$${MIN_TVL_USD / 1000}k): ${vaultsUpserted}`);
    log(`  Skipped non-active: ${skippedInvisible} ($${(skippedInvisibleTvlUsd / 1e6).toFixed(1)}M)`);
    log(`  Skipped non-EVM/unknown chain: ${skippedNonEvm} ($${(skippedNonEvmTvlUsd / 1e6).toFixed(1)}M)`);
    log(`  Skipped unattributed: ${skippedUnattributed.length}`);
    log(`  Cross-source overlaps (kept by incumbent pipeline): ${crossSourceOverlaps.length}`);
    for (const o of crossSourceOverlaps.slice(0, 10)) {
      log(`    ${o.name} ($${(o.tvl / 1e6).toFixed(1)}M) — owned by ${o.source}`);
    }
    log(`  Retired: ${deactivatedStale} stale Upshift rows, ${retiredTurtleDuplicates} frozen Turtle duplicates`);
    log(`  Errors: ${errors.length}`);
    log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    log("=".repeat(60));

    return {
      success: errors.length === 0,
      totalFetched,
      vaultsUpserted,
      snapshotsCreated: vaultsUpserted,
      skippedInvisible,
      skippedInvisibleTvlUsd,
      skippedNonEvm,
      skippedNonEvmTvlUsd,
      skippedUnattributed,
      crossSourceOverlaps,
      deactivatedStale,
      retiredTurtleDuplicates,
      errors,
      duration,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logError("Critical error during Upshift collection", error);
    errors.push(msg);
    return {
      success: false,
      totalFetched,
      vaultsUpserted,
      snapshotsCreated: vaultsUpserted,
      skippedInvisible,
      skippedInvisibleTvlUsd,
      skippedNonEvm,
      skippedNonEvmTvlUsd,
      skippedUnattributed,
      crossSourceOverlaps,
      deactivatedStale: 0,
      retiredTurtleDuplicates: 0,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

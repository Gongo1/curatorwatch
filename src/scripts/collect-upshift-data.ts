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
 *  - Cross-source guard: DB rows of other pipelines + the LIVE Turtle feed's
 *    receipt tokens (Turtle lists 7 Upshift opportunities — the incumbent
 *    keeps them).
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
  curatorId: string
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

    return { upserted: true };
  } catch (error) {
    return {
      upserted: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Refresh vaultCount + AUM for curators that own Upshift-sourced vaults. */
async function updateUpshiftCuratorStats() {
  const curators = await prisma.curator.findMany({
    where: { vaults: { some: { dataSource: "upshift" } } },
    select: { id: true },
  });
  for (const curator of curators) {
    const vaultIds = await prisma.vault.findMany({
      where: { curatorId: curator.id },
      select: { id: true },
    });
    let totalAssets = 0;
    for (const { id } of vaultIds) {
      const snapshot = await prisma.vaultSnapshot.findFirst({
        where: { vaultId: id },
        orderBy: { timestamp: "desc" },
        select: { totalAssetsUsd: true },
      });
      if (snapshot) totalAssets += snapshot.totalAssetsUsd;
    }
    await prisma.curator.update({
      where: { id: curator.id },
      data: { vaultCount: vaultIds.length, totalAssetsManaged: totalAssets },
    });
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
    log(`Fetched ${vaults.length} vaults from the Upshift platform`);

    // Identities owned by other pipelines (Morpho/Euler real addresses,
    // Turtle/fund onchainAddress) plus the live Turtle feed's receipt tokens.
    const foreign = await prisma.vault.findMany({
      where: { dataSource: { not: "upshift" } },
      select: { address: true, onchainAddress: true, chainId: true, dataSource: true },
    });
    const foreignKeys = new Map<string, string>();
    for (const v of foreign) {
      foreignKeys.set(`${v.address.toLowerCase()}:${v.chainId}`, v.dataSource);
      if (v.onchainAddress) foreignKeys.set(`${v.onchainAddress}:${v.chainId}`, v.dataSource);
    }
    try {
      for (const opp of await fetchTurtleOpportunities()) {
        const receipt = opp.receiptToken;
        if (!receipt?.address) continue;
        const chainId = resolveChainId(receipt.chain?.chainId, receipt.chain?.slug);
        if (chainId === null) continue;
        const key = `${receipt.address.toLowerCase()}:${chainId}`;
        if (!foreignKeys.has(key)) foreignKeys.set(key, "turtle (live feed)");
      }
    } catch (error) {
      logError("Turtle feed unavailable for the cross-source guard (continuing with DB-only guard)", error);
    }

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
      const owner = foreignKeys.get(`${addressLower}:${vault.chainId}`);
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

      const result = await upsertUpshiftVault(vault, curatorId);
      if (result.upserted) {
        vaultsUpserted++;
      } else if (result.error) {
        errors.push(`${vault.name}: ${result.error}`);
        logError(`Failed to upsert ${vault.name}: ${result.error}`);
      }
    }

    await updateUpshiftCuratorStats();

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
      errors,
      duration: Date.now() - startTime,
    };
  }
}

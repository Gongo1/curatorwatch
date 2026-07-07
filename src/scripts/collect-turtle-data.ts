/**
 * Turtle data collection pipeline.
 * Fetches managed positions from Turtle API for cross-protocol curator coverage.
 *
 * Filters: tvl >= $100K AND protocol !== "morpho" AND not a testnet chain (all
 * opportunity types — vault / lending / staking; curators run more than vaults).
 * Morpho vaults are already covered by the primary Morpho pipeline, so excluding them
 * prevents double-counting. Opportunities that don't resolve to a curator (denylisted
 * protocols/infra, or no curator name) are skipped, not stored.
 */

import { prisma } from "../lib/db";
import { fetchTurtleOpportunities } from "../lib/turtle/client";
import { extractProtocol } from "../lib/turtle/protocol-extractor";
import { matchCurator } from "../lib/turtle/curator-matcher";
import { resolveChainId, canonicalChainName } from "../lib/turtle/chain-mapper";
import { sanitizeApyPct } from "../lib/utils/sanitize-apy";
import type { TurtleOpportunity } from "../lib/turtle/types";

const MIN_TVL_USD = 100_000; // $100K dust floor

/** Testnet chains — balances here are not real TVL and must never be counted.
 * NOTE: "pharos" is a real MAINNET in the live Turtle feed (chainId 1672, active —
 * e.g. Axil's ~$8.4M of vaults), not a testnet; it must NOT be denylisted. A future
 * Pharos testnet would carry a distinct slug. */
const TESTNET_CHAINS = new Set([
  "sepolia", "goerli", "holesky", "fuji", "mumbai",
]);

export interface TurtleCollectionResult {
  success: boolean;
  totalFetched: number;
  filtered: number;
  vaultsUpserted: number;
  snapshotsCreated: number;
  curatorsCreated: number; // deprecated: synthetic curators are no longer created (always 0)
  vaultsAttributed: number; // vaults matched to a real curator
  unmatchedHidden: number; // vaults ingested but left unattributed (hidden from the directory)
  hiddenVaults: { name: string; tvl: number }[];
  // Opportunities whose receipt token matches a Morpho-sourced vault on the same
  // chain — the same on-chain vault seen through both pipelines. New ones are
  // skipped (never stored); ones with a pre-existing Turtle row are reported here
  // for review, NOT auto-unlinked (no silent drops).
  crossSourceOverlaps: { name: string; tvl: number; onchainAddress: string; existingRow: boolean }[];
  errors: string[];
  duration: number;
}

function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [TURTLE] ${message}`);
}

function logError(message: string, error?: unknown) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [TURTLE] ERROR: ${message}`, error ?? "");
}

/**
 * Filter Turtle opportunities to managed vaults we care about.
 */
function filterOpportunities(
  opportunities: TurtleOpportunity[]
): TurtleOpportunity[] {
  return opportunities.filter((opp) => {
    // All managed types (vault / lending / staking) — curators run more than vaults.

    // TVL threshold (dust floor)
    if ((opp.tvl ?? 0) < MIN_TVL_USD) return false;

    // Exclude Morpho (already covered by the primary pipeline → no double-counting)
    const protocol = extractProtocol(opp.description, opp.name, opp.protocol);
    if (protocol === "morpho") return false;

    // Exclude testnets — testnet balances are not real TVL
    const chainSlug = (
      opp.depositTokens?.[0]?.chain?.slug ??
      opp.chain?.slug ??
      "ethereum"
    ).toLowerCase();
    if (TESTNET_CHAINS.has(chainSlug)) return false;

    return true;
  });
}

/**
 * Upsert a single Turtle vault into the database.
 */
async function upsertTurtleVault(
  opp: TurtleOpportunity,
  morphoVaultKeys: Set<string>
): Promise<{
  upserted: boolean;
  matched: boolean;
  skipped?: boolean;
  curatorName: string;
  error?: string;
  overlap?: { onchainAddress: string; existingRow: boolean };
}> {
  try {
    const protocol = extractProtocol(opp.description, opp.name, opp.protocol);

    // Extract chain info. Prefer Turtle's authoritative numeric chainId (present on
    // every chain object) over the slug→id map, so chains we haven't enumerated are
    // never silently mislabeled as Ethereum (chainId 1). Skip + log if neither resolves.
    const chainObj = opp.depositTokens?.[0]?.chain ?? opp.chain;
    const chainSlug = (chainObj?.slug ?? "ethereum").toLowerCase();
    const chainId = resolveChainId(chainObj?.chainId, chainSlug);
    if (chainId === null) {
      return {
        upserted: false,
        matched: false,
        skipped: true,
        curatorName: opp.curator?.name ?? opp.name,
        error: `unknown chain (no numeric id, unmapped slug "${chainSlug}")`,
      };
    }
    const chainName = canonicalChainName(chainId, chainSlug);

    // Extract asset info from deposit tokens
    const depositToken = opp.depositTokens?.[0];
    const assetAddress = depositToken?.address ?? "unknown";
    const assetSymbol = depositToken?.symbol ?? "UNKNOWN";
    const assetDecimals = depositToken?.decimals ?? 18;

    // Resolve to a curator (name-based; Turtle gives no address). Returns null for
    // denylisted protocols/infra or opportunities with no curator name.
    const curatorName = opp.curator?.name ?? opp.name;
    const curatorId = await matchCurator(opp.name, opp.curator);

    // Only ingest opportunities that resolve to a curator — skip the rest (don't store
    // hidden rows), keeping the vault table clean under the broadened filter.
    if (curatorId === null) {
      return { upserted: false, matched: false, skipped: true, curatorName };
    }

    const syntheticAddress = `turtle-${opp.id}`;

    // Real on-chain identity: the receipt/share token is the vault contract for
    // ERC-4626-style opportunities. Stored lowercase for cross-source joins.
    const onchainAddress = opp.receiptToken?.address?.toLowerCase() ?? null;
    const onchainSymbol = opp.receiptToken?.symbol ?? null;

    // Cross-source guard: if the Morpho pipeline already tracks this exact vault
    // (same on-chain address + chain), don't create a second row for it. If a
    // Turtle row already exists from before, keep refreshing it but flag the
    // overlap in the run report so it can be reviewed and merged deliberately —
    // never auto-unlinked (no silent drops).
    const isOverlap =
      onchainAddress !== null && morphoVaultKeys.has(`${onchainAddress}:${chainId}`);
    if (isOverlap) {
      const existing = await prisma.vault.findUnique({
        where: { address: syntheticAddress },
        select: { id: true },
      });
      if (!existing) {
        return {
          upserted: false,
          matched: false,
          skipped: true,
          curatorName: opp.curator?.name ?? opp.name,
          overlap: { onchainAddress, existingRow: false },
        };
      }
    }

    // Turtle API returns estimatedApr as percentage (e.g. 8.33 = 8.33%).
    // Store directly as percentage — no APY conversion. Sanitize first: the Turtle
    // feed occasionally reports garbage (e.g. 5,769% on "Staked Plasma USD"), and
    // unlike the Morpho write path this one was previously unguarded. >200% → null,
    // which propagates to netAPR + the snapshot's decimal APY fields below.
    const estTotalAPR = sanitizeApyPct(opp.estimatedApr ?? null);

    // Build APR breakdown from incentives (name, description, rewardType, apr).
    const aprBreakdown = opp.incentives?.length > 0
      ? opp.incentives.map((inc) => ({
          source: inc.name ?? inc.token?.symbol ?? "Unknown",
          apr: inc.apr ?? 0,
          type: inc.rewardType ?? inc.type ?? "unknown",
        }))
      : null;

    // Vault-level data shared between create and update
    const vaultFields = {
      name: opp.name,
      turtleId: opp.id,
      protocol,
      curatorId,
      dataSource: "turtle" as const,
      opportunityType: opp.type,
      chainId,
      chainName,
      onchainAddress,
      onchainSymbol,
      estTotalAPR,
      netAPR: estTotalAPR,
      aprBreakdown: aprBreakdown ?? undefined,
      active: true, // a vault present in the current filtered set is active
    };

    // Snapshot stores APR as a decimal so yield math (tvl * netApy) still works.
    const aprDecimal = estTotalAPR != null ? estTotalAPR / 100 : null;

    // Upsert keyed on the deterministic synthetic address (`turtle-<opp.id>`). One
    // Turtle opportunity = one vault row — no curator+asset+chain dedup, which wrongly
    // collapsed distinct vaults of the same curator and desynced turtleId↔address.
    const vault = await prisma.vault.upsert({
      where: { address: syntheticAddress },
      update: { ...vaultFields, updatedAt: new Date() },
      create: {
        address: syntheticAddress,
        symbol: assetSymbol,
        assetAddress,
        assetSymbol,
        assetDecimals,
        ...vaultFields,
      },
    });

    await prisma.vaultSnapshot.create({
      data: {
        vaultId: vault.id,
        totalAssets: "0",
        totalAssetsUsd: opp.tvl,
        totalSupply: "0",
        sharePrice: 1,
        apy: aprDecimal,
        netApy: aprDecimal,
        avgApy: aprDecimal,
        avgNetApy: aprDecimal,
      },
    });

    return {
      upserted: true,
      matched: true,
      curatorName,
      overlap: isOverlap && onchainAddress ? { onchainAddress, existingRow: true } : undefined,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      upserted: false,
      matched: false,
      curatorName: opp.curator?.name ?? opp.name,
      error: msg,
    };
  }
}

/**
 * Update curator stats for curators that have Turtle-sourced vaults.
 */
async function updateTurtleCuratorStats() {
  const turtleCurators = await prisma.curator.findMany({
    where: {
      vaults: { some: { dataSource: "turtle" } },
    },
    select: { id: true, name: true, address: true },
  });

  for (const curator of turtleCurators) {
    const vaultCount = await prisma.vault.count({
      where: { curatorId: curator.id },
    });

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
      if (snapshot) {
        totalAssets += snapshot.totalAssetsUsd;
      }
    }

    await prisma.curator.update({
      where: { id: curator.id },
      data: { vaultCount, totalAssetsManaged: totalAssets },
    });
  }
}

/**
 * Main Turtle collection function.
 */
export async function collectTurtleData(): Promise<TurtleCollectionResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  log("=".repeat(60));
  log("Starting Turtle data collection...");

  try {
    // 1. Fetch all opportunities
    const allOpportunities = await fetchTurtleOpportunities();
    log(`Fetched ${allOpportunities.length} total opportunities from Turtle API`);

    // 2. Filter to relevant vaults
    const filtered = filterOpportunities(allOpportunities);
    log(`Filtered to ${filtered.length} opportunities (TVL>=$100K, non-Morpho, non-testnet)`);

    // Snapshot of Morpho-sourced vault identities for the cross-source guard
    // (real address + chain). Built once per run.
    const morphoVaults = await prisma.vault.findMany({
      where: { dataSource: "morpho" },
      select: { address: true, chainId: true },
    });
    const morphoVaultKeys = new Set(
      morphoVaults.map((v) => `${v.address.toLowerCase()}:${v.chainId}`)
    );

    // 3. Upsert each vault
    let vaultsUpserted = 0;
    let snapshotsCreated = 0;
    let vaultsAttributed = 0;
    // "hiddenVaults" now holds opportunities SKIPPED (not stored) because they didn't
    // resolve to a curator — denylisted protocols/infra, or no curator name.
    const hiddenVaults: { name: string; tvl: number }[] = [];
    const crossSourceOverlaps: TurtleCollectionResult["crossSourceOverlaps"] = [];

    for (const opp of filtered) {
      const result = await upsertTurtleVault(opp, morphoVaultKeys);
      if (result.overlap) {
        crossSourceOverlaps.push({
          name: opp.name,
          tvl: opp.tvl ?? 0,
          onchainAddress: result.overlap.onchainAddress,
          existingRow: result.overlap.existingRow,
        });
      }
      if (result.upserted) {
        vaultsUpserted++;
        snapshotsCreated++;
        vaultsAttributed++;
      } else if (result.skipped) {
        if (!result.overlap) {
          hiddenVaults.push({ name: result.curatorName, tvl: opp.tvl ?? 0 });
        }
      } else if (result.error) {
        errors.push(`${opp.name}: ${result.error}`);
        logError(`Failed to upsert ${opp.name}: ${result.error}`);
      }
    }
    const unmatchedHidden = hiddenVaults.length;

    if (crossSourceOverlaps.length > 0) {
      log(`  ⚠ Cross-source overlaps (same vault also tracked by the Morpho pipeline): ${crossSourceOverlaps.length}`);
      for (const o of crossSourceOverlaps.slice(0, 10)) {
        log(
          `    ${o.name} (${o.onchainAddress}, $${(o.tvl / 1e6).toFixed(1)}M) — ${o.existingRow ? "EXISTING Turtle row, review & merge" : "new, skipped"}`
        );
      }
    }

    // 4. Update curator stats
    await updateTurtleCuratorStats();

    const duration = Date.now() - startTime;

    log("-".repeat(60));
    log("Turtle collection completed!");
    log(`  Total fetched: ${allOpportunities.length}`);
    log(`  Filtered: ${filtered.length}`);
    log(`  Vaults upserted: ${vaultsUpserted}`);
    log(`  Snapshots created: ${snapshotsCreated}`);
    log(`  Attributed to a curator: ${vaultsAttributed}`);
    log(`  Skipped (unresolved — denylisted protocols / no curator): ${unmatchedHidden}`);
    if (hiddenVaults.length > 0) {
      const distinct = [...new Set(hiddenVaults.map((h) => h.name))];
      log(
        `    ${distinct.slice(0, 30).join(", ")}${distinct.length > 30 ? ` … +${distinct.length - 30} more` : ""}`
      );
    }
    log(`  Errors: ${errors.length}`);
    log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    log("=".repeat(60));

    return {
      success: errors.length === 0,
      totalFetched: allOpportunities.length,
      filtered: filtered.length,
      vaultsUpserted,
      snapshotsCreated,
      curatorsCreated: 0,
      vaultsAttributed,
      unmatchedHidden,
      hiddenVaults,
      crossSourceOverlaps,
      errors,
      duration,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logError("Critical error during Turtle collection", error);
    errors.push(msg);

    return {
      success: false,
      totalFetched: 0,
      filtered: 0,
      vaultsUpserted: 0,
      snapshotsCreated: 0,
      curatorsCreated: 0,
      vaultsAttributed: 0,
      unmatchedHidden: 0,
      hiddenVaults: [],
      crossSourceOverlaps: [],
      errors,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Turtle data collection pipeline.
 * Fetches managed vaults from Turtle API for cross-protocol coverage.
 *
 * Filters: type === "vault" AND tvl > $1M AND protocol !== "morpho"
 * (Morpho vaults are already covered by the primary Morpho pipeline.)
 */

import { prisma } from "../lib/db";
import { fetchTurtleOpportunities } from "../lib/turtle/client";
import { extractProtocol } from "../lib/turtle/protocol-extractor";
import { matchCurator } from "../lib/turtle/curator-matcher";
import { getChainId, getChainName } from "../lib/turtle/chain-mapper";
import type { TurtleOpportunity } from "../lib/turtle/types";

const MIN_TVL_USD = 1_000_000; // $1M

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
    // Only managed vaults
    if (opp.type !== "vault") return false;

    // TVL threshold
    if ((opp.tvl ?? 0) < MIN_TVL_USD) return false;

    // Exclude Morpho (already covered by primary pipeline)
    const protocol = extractProtocol(opp.description, opp.name, opp.protocol);
    if (protocol === "morpho") return false;

    return true;
  });
}

/**
 * Upsert a single Turtle vault into the database.
 */
async function upsertTurtleVault(
  opp: TurtleOpportunity
): Promise<{ upserted: boolean; matched: boolean; curatorName: string; error?: string }> {
  try {
    const protocol = extractProtocol(opp.description, opp.name, opp.protocol);

    // Extract chain info from deposit tokens
    const chainSlug =
      opp.depositTokens?.[0]?.chain?.slug ??
      opp.chain?.slug ??
      "ethereum";
    const chainId = getChainId(chainSlug);
    const chainName = getChainName(chainSlug);

    // Extract asset info from deposit tokens
    const depositToken = opp.depositTokens?.[0];
    const assetAddress = depositToken?.address ?? "unknown";
    const assetSymbol = depositToken?.symbol ?? "UNKNOWN";
    const assetDecimals = depositToken?.decimals ?? 18;

    // Best-effort match to an existing curator (name-based; Turtle gives no address).
    // null = unattributed: we still ingest the vault but leave it hidden from the
    // curator directory and report it, rather than minting a synthetic curator.
    const curatorName = opp.curator?.name ?? opp.name;
    const curatorId = await matchCurator(opp.name, opp.curator);

    // Check if existing by turtleId
    const existingByTurtle = await prisma.vault.findUnique({
      where: { turtleId: opp.id },
    });

    // Check for potential duplicate by curator + asset + chain + protocol.
    // Only when attributed — a null curatorId would wrongly collapse distinct
    // unattributed vaults together.
    const existingByCombo = !existingByTurtle && curatorId
      ? await prisma.vault.findFirst({
          where: {
            curatorId,
            assetSymbol,
            chainId,
            protocol,
          },
        })
      : null;

    const existing = existingByTurtle ?? existingByCombo;
    const syntheticAddress = `turtle-${opp.id}`;

    // Turtle API returns estimatedApr as percentage (e.g. 8.33 = 8.33%).
    // Store directly as percentage — no APY conversion.
    const estTotalAPR = opp.estimatedApr ?? null;

    // Build APR breakdown from incentives
    // Turtle API incentives have: name, description, rewardType, apr
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
      chainName,
      estTotalAPR,
      netAPR: estTotalAPR,
      aprBreakdown: aprBreakdown ?? undefined,
    };

    // Snapshot uses APR stored as decimal for avgApy/avgNetApy
    // so yield calculations still work (they multiply tvl * netApy)
    const aprDecimal = estTotalAPR != null ? estTotalAPR / 100 : null;

    if (existing) {
      // Update existing vault
      await prisma.vault.update({
        where: { id: existing.id },
        data: {
          ...vaultFields,
          updatedAt: new Date(),
        },
      });

      // Create snapshot — store APR as decimal in apy/netApy fields
      // for backward-compatible yield calculations
      await prisma.vaultSnapshot.create({
        data: {
          vaultId: existing.id,
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

      return { upserted: true, matched: curatorId !== null, curatorName };
    }

    // Create new vault
    const vault = await prisma.vault.create({
      data: {
        address: syntheticAddress,
        symbol: assetSymbol,
        chainId,
        assetAddress,
        assetSymbol,
        assetDecimals,
        ...vaultFields,
      },
    });

    // Create initial snapshot
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

    return { upserted: true, matched: curatorId !== null, curatorName };
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
    log(`Filtered to ${filtered.length} vaults (type=vault, TVL>$1M, non-Morpho)`);

    // 3. Upsert each vault
    let vaultsUpserted = 0;
    let snapshotsCreated = 0;
    let vaultsAttributed = 0;
    const hiddenVaults: { name: string; tvl: number }[] = [];

    for (const opp of filtered) {
      const result = await upsertTurtleVault(opp);
      if (result.upserted) {
        vaultsUpserted++;
        snapshotsCreated++;
        if (result.matched) {
          vaultsAttributed++;
        } else {
          // Ingested but unattributed: hidden from the curator directory, reported here.
          hiddenVaults.push({ name: result.curatorName, tvl: opp.tvl ?? 0 });
        }
      } else if (result.error) {
        errors.push(`${opp.name}: ${result.error}`);
        logError(`Failed to upsert ${opp.name}: ${result.error}`);
      }
    }
    const unmatchedHidden = hiddenVaults.length;

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
    log(`  Unmatched (hidden, unattributed): ${unmatchedHidden}`);
    if (hiddenVaults.length > 0) {
      log(`  Hidden vaults (need curator mapping in curator-matcher.ts):`);
      for (const hv of hiddenVaults) {
        log(`    - ${hv.name} ($${(hv.tvl / 1_000_000).toFixed(2)}M)`);
      }
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
      errors,
      duration: Date.now() - startTime,
    };
  }
}

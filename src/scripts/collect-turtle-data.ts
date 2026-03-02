/**
 * Turtle Club data collection pipeline.
 * Fetches managed vaults from Turtle API for cross-protocol coverage.
 *
 * Filters: type === "vault" AND tvl > $1M AND protocol !== "morpho"
 * (Morpho vaults are already covered by the primary Morpho pipeline.)
 */

import { prisma } from "../lib/db";
import { fetchTurtleOpportunities } from "../lib/turtle/client";
import { extractProtocol } from "../lib/turtle/protocol-extractor";
import { findOrCreateCurator } from "../lib/turtle/curator-matcher";
import { getChainId, getChainName } from "../lib/turtle/chain-mapper";
import type { TurtleOpportunity } from "../lib/turtle/types";

const MIN_TVL_USD = 1_000_000; // $1M

export interface TurtleCollectionResult {
  success: boolean;
  totalFetched: number;
  filtered: number;
  vaultsUpserted: number;
  snapshotsCreated: number;
  curatorsCreated: number;
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
    const protocol = extractProtocol(opp.description, opp.name);
    if (protocol === "morpho") return false;

    return true;
  });
}

/**
 * Upsert a single Turtle vault into the database.
 */
async function upsertTurtleVault(
  opp: TurtleOpportunity
): Promise<{ upserted: boolean; curatorCreated: boolean; error?: string }> {
  try {
    const protocol = extractProtocol(opp.description, opp.name);

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

    // Find or create curator using API curator field
    const curatorId = await findOrCreateCurator(opp.name, opp.curator);

    // Check if existing by turtleId
    const existingByTurtle = await prisma.vault.findUnique({
      where: { turtleId: opp.id },
    });

    // Check for potential duplicate by curator + asset + chain + protocol
    const existingByCombo = !existingByTurtle
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

    if (existing) {
      // Update existing vault
      await prisma.vault.update({
        where: { id: existing.id },
        data: {
          name: opp.name,
          turtleId: opp.id,
          protocol,
          dataSource: "turtle",
          opportunityType: opp.type,
          chainName,
          updatedAt: new Date(),
        },
      });

      // Turtle API returns estimatedApr as percentage (e.g. 53.69 = 53.69%),
      // but the DB stores APY as decimal (0.5369). Divide by 100.
      const aprDecimal = opp.estimatedApr != null ? opp.estimatedApr / 100 : null;

      // Create snapshot
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

      return { upserted: true, curatorCreated: false };
    }

    // Turtle API returns estimatedApr as percentage (e.g. 53.69 = 53.69%),
    // but the DB stores APY as decimal (0.5369). Divide by 100.
    const aprDecimal = opp.estimatedApr != null ? opp.estimatedApr / 100 : null;

    // Create new vault
    const vault = await prisma.vault.create({
      data: {
        address: syntheticAddress,
        name: opp.name,
        symbol: assetSymbol,
        chainId,
        assetAddress,
        assetSymbol,
        assetDecimals,
        curatorId,
        protocol,
        turtleId: opp.id,
        dataSource: "turtle",
        opportunityType: opp.type,
        chainName,
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

    return { upserted: true, curatorCreated: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { upserted: false, curatorCreated: false, error: msg };
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
    let curatorsCreated = 0;

    for (const opp of filtered) {
      const result = await upsertTurtleVault(opp);
      if (result.upserted) {
        vaultsUpserted++;
        snapshotsCreated++;
        if (result.curatorCreated) curatorsCreated++;
      } else if (result.error) {
        errors.push(`${opp.name}: ${result.error}`);
        logError(`Failed to upsert ${opp.name}: ${result.error}`);
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
    log(`  Curators created: ${curatorsCreated}`);
    log(`  Errors: ${errors.length}`);
    log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    log("=".repeat(60));

    return {
      success: errors.length === 0,
      totalFetched: allOpportunities.length,
      filtered: filtered.length,
      vaultsUpserted,
      snapshotsCreated,
      curatorsCreated,
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
      errors,
      duration: Date.now() - startTime,
    };
  }
}

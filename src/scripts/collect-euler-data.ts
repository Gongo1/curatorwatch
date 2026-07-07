/**
 * Euler data collection pipeline (P2 of the coverage roadmap).
 *
 * Ingests curated Euler vaults — EVK lending vaults + EulerEarn aggregator
 * vaults — across every Euler-enabled chain, attributed to curators via the
 * euler-labels registry (see lib/euler/client.ts for source details).
 *
 * Policy (curator-first, mirrors the Turtle pipeline):
 *  - EVK vaults are ingested only when LABELED: EVK deployment is
 *    permissionless and the unlabeled tail is junk. Skipped vaults are
 *    reported, never silent.
 *  - Earn (aggregator) vaults additionally fall back to name-matching against
 *    EXISTING curators ("TelosC Surge", "K3 Capital Earn WETH" — the labels
 *    repo lags on these). The fallback never creates a curator, so a
 *    troll-named vault can't mint one.
 *  - Vaults on a product's deprecatedVaults list are excluded (frozen /
 *    insolvency-exposed markets are not live TVL).
 *  - TVL floor $50k (same as new Morpho chains).
 *  - Cross-source guard: a vault already tracked by another pipeline (Morpho
 *    row, or a Turtle opportunity whose receipt token is this vault — checked
 *    against the LIVE Turtle feed, not just the DB) is skipped and reported —
 *    the incumbent source keeps it; no double-counting.
 *  - Curator resolution reuses matchCurator (name-based: existing rows first,
 *    then a clean `tc:<slug>` created from the labels entity name).
 */

import { prisma } from "../lib/db";
import {
  EULER_CHAIN_IDS,
  fetchEulerVaults,
  fetchEulerAttribution,
  type EulerApiVault,
} from "../lib/euler/client";
import { fetchSonicEulerVaults } from "../lib/euler/onchain";
import { matchCurator } from "../lib/turtle/curator-matcher";
import { fetchTurtleOpportunities } from "../lib/turtle/client";
import { resolveChainId, canonicalChainName } from "../lib/turtle/chain-mapper";
import { sanitizeApyPct } from "../lib/utils/sanitize-apy";

const MIN_TVL_USD = 50_000;

export interface EulerCollectionResult {
  success: boolean;
  totalFetched: number;
  vaultsUpserted: number;
  snapshotsCreated: number;
  vaultsAttributed: number;
  nameAttributed: number; // Earn vaults attributed by name-match (no label entry)
  skippedUnlabeled: number; // fetched, above floor, but no attribution → not stored
  skippedUnlabeledTvlUsd: number;
  skippedDeprecated: number; // on a product's deprecatedVaults list
  crossSourceOverlaps: { name: string; tvl: number; address: string; source: string }[];
  errors: string[];
  duration: number;
}

function log(message: string) {
  console.log(`[${new Date().toISOString()}] [EULER] ${message}`);
}

function logError(message: string, error?: unknown) {
  console.error(`[${new Date().toISOString()}] [EULER] ERROR: ${message}`, error ?? "");
}

async function upsertEulerVault(
  vault: EulerApiVault,
  kind: "evk" | "earn",
  curatorId: string,
  listed = true
): Promise<{ upserted: boolean; skipped?: boolean; error?: string }> {
  try {
    const chainId = vault.chainId;
    const chainName = canonicalChainName(chainId);
    const addressLower = vault.address.toLowerCase();

    const estTotalAPR = sanitizeApyPct(vault.supplyApy ?? null);
    const aprDecimal = estTotalAPR != null ? estTotalAPR / 100 : null;
    const creationTimestamp = vault.createdAt
      ? Math.floor(new Date(vault.createdAt).getTime() / 1000)
      : undefined;

    const vaultFields = {
      name: vault.name,
      protocol: "euler",
      curatorId,
      dataSource: "euler" as const,
      opportunityType: kind === "earn" ? "euler-earn" : "evk",
      chainId,
      chainName,
      onchainAddress: addressLower,
      onchainSymbol: vault.symbol,
      estTotalAPR,
      netAPR: estTotalAPR,
      creationTimestamp,
      active: true,
      // Wound-down (non-insolvency deprecated) markets that still hold funds
      // count toward curator AUM but aren't promoted in the directory.
      listed,
    };

    const existing = await prisma.vault.findUnique({
      where: { address: vault.address },
      select: { id: true, chainId: true },
    });
    // Same global-unique-address caveat as the Morpho pipeline: never let a
    // same-address vault on another chain clobber an existing row.
    if (existing && existing.chainId !== chainId) {
      log(`  ⚠ Address collision across chains, skipping: ${vault.address} (db chain ${existing.chainId}, api chain ${chainId})`);
      return { upserted: false, skipped: true };
    }

    const row = await prisma.vault.upsert({
      where: { address: vault.address },
      update: { ...vaultFields, updatedAt: new Date() },
      create: {
        address: vault.address,
        symbol: vault.symbol,
        assetAddress: vault.asset?.address ?? "unknown",
        assetSymbol: vault.asset?.symbol ?? "UNKNOWN",
        assetDecimals: vault.asset?.decimals ?? 18,
        ...vaultFields,
      },
    });

    await prisma.vaultSnapshot.create({
      data: {
        vaultId: row.id,
        totalAssets: String(vault.totalAssets ?? "0"),
        totalAssetsUsd: vault.totalSupplyUsd ?? 0,
        totalSupply: "0",
        sharePrice: 1,
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

/** Refresh vaultCount + AUM for curators that own Euler-sourced vaults. */
async function updateEulerCuratorStats() {
  const curators = await prisma.curator.findMany({
    where: { vaults: { some: { dataSource: "euler" } } },
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

export async function collectEulerData(): Promise<EulerCollectionResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  log("=".repeat(60));
  log("Starting Euler data collection...");

  let totalFetched = 0;
  let vaultsUpserted = 0;
  let nameAttributed = 0;
  let skippedUnlabeled = 0;
  let skippedUnlabeledTvlUsd = 0;
  let skippedDeprecated = 0;
  const crossSourceOverlaps: EulerCollectionResult["crossSourceOverlaps"] = [];

  try {
    // Vault identities already owned by another pipeline (Morpho rows use the
    // real address; Turtle rows carry it in onchainAddress). Built once.
    const foreign = await prisma.vault.findMany({
      where: { dataSource: { not: "euler" } },
      select: { address: true, onchainAddress: true, chainId: true, dataSource: true },
    });
    const foreignKeys = new Map<string, string>(); // addr:chainId → dataSource
    for (const v of foreign) {
      foreignKeys.set(`${v.address.toLowerCase()}:${v.chainId}`, v.dataSource);
      if (v.onchainAddress) foreignKeys.set(`${v.onchainAddress}:${v.chainId}`, v.dataSource);
    }

    // Existing curator names for the Earn prefix-match fallback ("TelosC
    // Surge" → TelosC). Longest names first so "K3 Capital" wins over "K3".
    const curatorNameRows = await prisma.curator.findMany({
      where: { name: { not: null } },
      select: { name: true },
    });
    const curatorNamesByLength = curatorNameRows
      .map((c) => c.name!.trim())
      .filter((n) => n.length >= 4)
      .sort((a, b) => b.length - a.length);

    // Belt-and-braces: also key the LIVE Turtle feed's receipt tokens, so the
    // guard holds even before the Turtle cron has backfilled onchainAddress
    // onto older rows (a Turtle-listed Euler vault must not be double-counted).
    try {
      const opportunities = await fetchTurtleOpportunities();
      for (const opp of opportunities) {
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

    // Each chain independent: one chain's API trouble must not kill the run.
    for (const chainId of EULER_CHAIN_IDS) {
      const chainName = canonicalChainName(chainId);
      try {
        const [evk, earn, labels] = await Promise.all([
          fetchEulerVaults(chainId, "evk"),
          fetchEulerVaults(chainId, "earn"),
          fetchEulerAttribution(chainId),
        ]);
        const candidates: Array<{ vault: EulerApiVault; kind: "evk" | "earn" }> = [
          ...evk.map((vault) => ({ vault, kind: "evk" as const })),
          ...earn.map((vault) => ({ vault, kind: "earn" as const })),
        ];
        totalFetched += candidates.length;

        let chainUpserted = 0;
        for (const { vault, kind } of candidates) {
          if ((vault.totalSupplyUsd ?? 0) < MIN_TVL_USD) continue;

          const addressLower = vault.address.toLowerCase();

          // Frozen/insolvency-exposed markets are not live TVL — never ingest.
          if (labels.deprecated.has(addressLower)) {
            skippedDeprecated++;
            continue;
          }

          const owner = foreignKeys.get(`${addressLower}:${vault.chainId}`);
          if (owner) {
            crossSourceOverlaps.push({
              name: vault.name,
              tvl: vault.totalSupplyUsd ?? 0,
              address: addressLower,
              source: owner,
            });
            continue; // incumbent pipeline keeps the vault
          }

          // Curator resolution: labels entity first; Earn vaults fall back to
          // name-matching against EXISTING curators only (fallback path inside
          // matchCurator never creates from an extracted name).
          const attr = labels.attribution.get(addressLower);
          let curatorId: string | null = null;
          let viaName = false;
          if (attr) {
            curatorId = await matchCurator(attr.productName, {
              name: attr.entityName,
              landingUrl: attr.entityUrl,
            });
          } else if (kind === "earn") {
            // (a) matchCurator's own extraction path (matches existing only);
            // (b) prefix match: the vault name must START WITH an existing
            //     curator's exact name ("TelosC Surge" → TelosC). Neither path
            //     can create a curator from a vault title.
            curatorId = await matchCurator(vault.name);
            if (curatorId === null) {
              const vaultLower = vault.name.toLowerCase();
              const prefixHit = curatorNamesByLength.find(
                (n) =>
                  vaultLower === n.toLowerCase() ||
                  vaultLower.startsWith(n.toLowerCase() + " ")
              );
              if (prefixHit) {
                curatorId = await matchCurator(vault.name, { name: prefixHit });
              }
            }
            viaName = curatorId !== null;
          }
          if (curatorId === null) {
            skippedUnlabeled++;
            skippedUnlabeledTvlUsd += vault.totalSupplyUsd ?? 0;
            continue;
          }

          const result = await upsertEulerVault(vault, kind, curatorId);
          if (result.upserted) {
            chainUpserted++;
            if (viaName) nameAttributed++;
          } else if (result.error) {
            errors.push(`${vault.name}: ${result.error}`);
            logError(`Failed to upsert ${vault.name}: ${result.error}`);
          }
        }

        vaultsUpserted += chainUpserted;
        log(`  ${chainName}: ${candidates.length} fetched, ${chainUpserted} upserted`);
      } catch (error) {
        const msg = `${chainName} failed: ${error instanceof Error ? error.message : error}`;
        logError(msg);
        errors.push(msg);
      }
    }

    // ── Sonic (chainId 146): v3 API doesn't serve it — read on-chain ────────
    try {
      const sonic = await fetchSonicEulerVaults();
      let sonicUpserted = 0;
      for (const vault of sonic.vaults) {
        if (vault.tvlUsd < MIN_TVL_USD) continue;

        const addressLower = vault.address.toLowerCase();
        const owner = foreignKeys.get(`${addressLower}:146`);
        if (owner) {
          crossSourceOverlaps.push({ name: vault.name, tvl: vault.tvlUsd, address: addressLower, source: owner });
          continue;
        }

        const curatorId = await matchCurator(vault.productName, {
          name: vault.entityName,
          landingUrl: vault.entityUrl,
        });
        if (curatorId === null) {
          skippedUnlabeled++;
          skippedUnlabeledTvlUsd += vault.tvlUsd;
          continue;
        }

        const result = await upsertEulerVault(
          {
            chainId: 146,
            address: vault.address,
            name: vault.name,
            symbol: vault.assetSymbol,
            decimals: vault.assetDecimals,
            asset: { address: vault.assetAddress, symbol: vault.assetSymbol, decimals: vault.assetDecimals },
            totalAssets: "0",
            totalSupplyUsd: vault.tvlUsd,
            supplyApy: null, // no APY oracle on-chain — null, not a guess
          },
          "evk",
          curatorId,
          vault.listed
        );
        if (result.upserted) {
          sonicUpserted++;
        } else if (result.error) {
          errors.push(`${vault.name}: ${result.error}`);
        }
      }
      vaultsUpserted += sonicUpserted;
      log(`  Sonic (on-chain): ${sonic.vaults.length} readable funded vaults, ${sonicUpserted} upserted (${sonic.vaults.filter((v) => !v.listed).length} wound-down → listed=false)`);
      if (sonic.skippedNonStable.length > 0) {
        log(`    non-stable assets skipped (no oracle): ${sonic.skippedNonStable.map((s) => s.symbol).join(", ")}`);
      }
      log(`    insolvency-deprecated excluded: ${sonic.skippedInsolvency} · empty/unreadable: ${sonic.skippedEmpty}`);
    } catch (error) {
      const msg = `Sonic on-chain failed: ${error instanceof Error ? error.message : error}`;
      logError(msg);
      errors.push(msg);
    }

    await updateEulerCuratorStats();

    const duration = Date.now() - startTime;
    log("-".repeat(60));
    log("Euler collection completed!");
    log(`  Fetched: ${totalFetched} vaults across ${EULER_CHAIN_IDS.length} chains`);
    log(`  Upserted (attributed, ≥$${MIN_TVL_USD / 1000}k): ${vaultsUpserted} (${nameAttributed} via Earn name-match)`);
    log(`  Skipped unattributed ≥floor: ${skippedUnlabeled} ($${(skippedUnlabeledTvlUsd / 1e6).toFixed(1)}M)`);
    log(`  Skipped deprecated markets: ${skippedDeprecated}`);
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
      vaultsAttributed: vaultsUpserted,
      nameAttributed,
      skippedUnlabeled,
      skippedUnlabeledTvlUsd,
      skippedDeprecated,
      crossSourceOverlaps,
      errors,
      duration,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logError("Critical error during Euler collection", error);
    errors.push(msg);
    return {
      success: false,
      totalFetched,
      vaultsUpserted,
      snapshotsCreated: vaultsUpserted,
      vaultsAttributed: vaultsUpserted,
      nameAttributed,
      skippedUnlabeled,
      skippedUnlabeledTvlUsd,
      skippedDeprecated,
      crossSourceOverlaps,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

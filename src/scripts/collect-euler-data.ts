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
 *  - Vaults on a product's deprecatedVaults list or flagged deprecated in
 *    earn-vaults.json are excluded (frozen / insolvency-exposed markets are
 *    not live TVL).
 *  - TVL floor $50k (same as new Morpho chains).
 *  - Cross-source guard (one active row per vault, never two):
 *      · a non-Turtle row (Morpho, …) owns the vault → skip;
 *      · an active Turtle row that the LIVE Turtle feed still lists owns it →
 *        skip (Turtle keeps refreshing it);
 *      · otherwise an existing Euler row is the incumbent → refresh it, and
 *        retire (active=false) a Turtle row for the same vault that the live
 *        feed no longer lists — it is a frozen duplicate;
 *      · a vault only in the live Turtle feed (no row yet) is left to Turtle.
 *    If the Turtle feed can't be read, every active Turtle row counts as live
 *    (conservative: skip, never double count) and the run reports an error.
 *  - Stale sweep: on every chain that fetched cleanly, Euler rows this run did
 *    not ingest (dropped below the floor, deprecated, unlabeled, now owned by
 *    Turtle) are set active=false, so a vault can never stay "live" on a
 *    frozen snapshot again.
 *  - Fail loud: any chain/source failure lands in `errors`, `success` is false
 *    and the cron route answers HTTP 500 (the Jul-2026 outage returned 200 for
 *    12 weeks while ingesting nothing).
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
  skippedDeprecated: number; // deprecated in products.json or earn-vaults.json
  crossSourceOverlaps: { name: string; tvl: number; address: string; source: string }[];
  deactivatedStale: number; // Euler rows this run retired (see stale sweep)
  retiredTurtleDuplicates: number; // Turtle rows for Euler vaults the live Turtle feed dropped
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
    // Vault identities already owned by a non-Turtle pipeline (Morpho rows
    // use the real address; others carry it in onchainAddress). Built once.
    const foreign = await prisma.vault.findMany({
      where: { dataSource: { notIn: ["euler", "turtle"] } },
      select: { address: true, onchainAddress: true, chainId: true, dataSource: true },
    });
    const foreignKeys = new Map<string, string>(); // addr:chainId → dataSource
    for (const v of foreign) {
      foreignKeys.set(`${v.address.toLowerCase()}:${v.chainId}`, v.dataSource);
      if (v.onchainAddress) foreignKeys.set(`${v.onchainAddress}:${v.chainId}`, v.dataSource);
    }

    // Active Turtle rows by on-chain identity, and this pipeline's own rows.
    const turtleRows = new Map<string, { id: string; turtleId: string | null }>(); // addr:chainId →
    for (const v of await prisma.vault.findMany({
      where: { dataSource: "turtle", active: true, onchainAddress: { not: null } },
      select: { id: true, turtleId: true, onchainAddress: true, chainId: true },
    })) {
      turtleRows.set(`${v.onchainAddress}:${v.chainId}`, { id: v.id, turtleId: v.turtleId });
    }
    const eulerRows = await prisma.vault.findMany({
      where: { dataSource: "euler" },
      select: { id: true, address: true, chainId: true, active: true },
    });
    const eulerKeys = new Set(eulerRows.map((v) => `${v.address.toLowerCase()}:${v.chainId}`));

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

    // Receipt tokens (addr:chainId) and opportunity ids the LIVE Turtle feed
    // lists. null = feed unreadable → every active Turtle row is treated as
    // live (skip, never double count).
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

    /**
     * Who owns this vault? `null` = Euler ingests it. Also records a frozen
     * Turtle duplicate for retirement when Euler takes (or keeps) the vault.
     */
    const retireTurtleIds = new Set<string>();
    const isFrozenTurtle = (row: { turtleId: string | null }, key: string) =>
      liveTurtle !== null && !liveTurtle.has(key) && !(row.turtleId && liveTurtle.has(row.turtleId));
    const ownerOf = (key: string): string | null => {
      const other = foreignKeys.get(key);
      if (other) return other;
      const turtleRow = turtleRows.get(key);
      if (turtleRow && !isFrozenTurtle(turtleRow, key)) return "turtle";
      if (!eulerKeys.has(key) && liveTurtle?.has(key)) return "turtle (live feed)";
      if (turtleRow) retireTurtleIds.add(turtleRow.id); // frozen: the live feed dropped it
      return null;
    };

    // addr:chainId of every vault this run decided to ingest; chains whose
    // fetch completed. Together they drive the stale sweep.
    const kept = new Set<string>();
    const cleanChains = new Set<number>();

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

          // Frozen/insolvency-exposed markets are not live TVL — never ingest,
          // and retire a Turtle copy the live feed has dropped (it would keep
          // counting the frozen TVL forever).
          if (labels.deprecated.has(addressLower)) {
            skippedDeprecated++;
            const turtleRow = turtleRows.get(`${addressLower}:${vault.chainId}`);
            if (turtleRow && isFrozenTurtle(turtleRow, `${addressLower}:${vault.chainId}`)) {
              retireTurtleIds.add(turtleRow.id);
            }
            continue;
          }

          const owner = ownerOf(`${addressLower}:${vault.chainId}`);
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

          kept.add(`${addressLower}:${vault.chainId}`);
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
        cleanChains.add(chainId);
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
        const owner = ownerOf(`${addressLower}:146`);
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

        kept.add(`${addressLower}:146`);
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
      // Sweep Sonic only on a fully readable pass: a flaky RPC must not retire
      // a funded vault.
      if (sonic.unreadable === 0) cleanChains.add(146);
      log(`  Sonic (on-chain): ${sonic.vaults.length} readable funded vaults, ${sonicUpserted} upserted (${sonic.vaults.filter((v) => !v.listed).length} wound-down → listed=false)`);
      if (sonic.skippedNonStable.length > 0) {
        log(`    non-stable assets skipped (no oracle): ${sonic.skippedNonStable.map((s) => s.symbol).join(", ")}`);
      }
      log(`    insolvency-deprecated excluded: ${sonic.skippedInsolvency} · empty: ${sonic.skippedEmpty} · unreadable: ${sonic.unreadable}`);
    } catch (error) {
      const msg = `Sonic on-chain failed: ${error instanceof Error ? error.message : error}`;
      logError(msg);
      errors.push(msg);
    }

    // ── Stale sweep + frozen-duplicate retirement ───────────────────────────
    const staleIds = eulerRows
      .filter(
        (v) =>
          v.active &&
          cleanChains.has(v.chainId) &&
          !kept.has(`${v.address.toLowerCase()}:${v.chainId}`)
      )
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

    if (vaultsUpserted === 0) {
      errors.push("0 Euler vaults upserted — source returned nothing usable");
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
    log(`  Retired: ${deactivatedStale} stale Euler rows, ${retiredTurtleDuplicates} frozen Turtle duplicates`);
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
      deactivatedStale,
      retiredTurtleDuplicates,
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
      deactivatedStale: 0,
      retiredTurtleDuplicates: 0,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

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
 *  - Bounded runtime: every source (v3 API, labels, Sonic RPC, Turtle feed)
 *    is fetched in parallel under one FETCH_BUDGET_MS budget with per-request
 *    timeouts; a source that runs out of time is an error (fail loud) and its
 *    chain is not swept. DB writes are batched (a fixed ~15 round trips per
 *    run, not ~5 per vault).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import {
  EULER_CHAIN_IDS,
  fetchEulerVaults,
  fetchEulerAttribution,
  type EulerApiVault,
} from "../lib/euler/client";
import { fetchSonicEulerVaults, type SonicFetchResult } from "../lib/euler/onchain";
import { matchCurator } from "../lib/turtle/curator-matcher";
import { fetchTurtleOpportunities } from "../lib/turtle/client";
import type { TurtleCurator } from "../lib/turtle/types";
import { resolveChainId, canonicalChainName } from "../lib/turtle/chain-mapper";
import { sanitizeApyPct } from "../lib/utils/sanitize-apy";
import { mapLimit } from "../lib/utils/map-limit";
import { assessPhantom } from "../lib/data-quality/phantom";
import { finalizeCollection, recordSnapshotsWritten } from "../lib/data-quality/maintenance";

const MIN_TVL_USD = 50_000;
/**
 * Wall-clock budget for ALL source fetches of a run (they run in parallel).
 * Measured 2026-09-30: Turtle feed ~5s, v3 API + labels ~2s for all chains
 * at 4 at a time, Sonic ~2s (JSON-RPC batches). The budget leaves the DB
 * phase well inside the 60s target and the 300s function cap.
 */
const FETCH_BUDGET_MS = 30_000;
// Chains fetched at once (each is evk + earn + labels in parallel): ~34 v3
// requests per run, far under the anonymous 100 req/min tier.
const CHAIN_CONCURRENCY = 4;
const WRITE_CHUNK = 200;

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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** One vault this run decided to ingest. */
interface PlannedVault {
  vault: EulerApiVault;
  kind: "evk" | "earn";
  curatorId: string;
  listed: boolean;
  viaName: boolean;
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Upsert every planned vault, write its snapshot and stamp it — the batch
 * form of the old per-vault upsert (same fields, same collision guard, same
 * phantom test) in a fixed number of round trips:
 *   1 findMany (existing rows) · createManyAndReturn (new rows) ·
 *   1 UPDATE ... FROM (VALUES) (existing rows) · createMany (snapshots) ·
 *   1 stamp UPDATE — each per chunk of WRITE_CHUNK rows.
 * Returns the vaults written. Throws on a DB failure (the caller reports it).
 */
async function writeEulerVaults(planned: PlannedVault[]): Promise<PlannedVault[]> {
  if (planned.length === 0) return [];

  // One write per address. A repeat in the same run is dropped (the old
  // per-vault loop would have written it twice or hit the collision guard).
  const byAddress = new Map<string, PlannedVault>();
  for (const p of planned) {
    if (byAddress.has(p.vault.address)) {
      log(`  ⚠ Duplicate address in this run, keeping the first: ${p.vault.address} (chain ${p.vault.chainId})`);
      continue;
    }
    byAddress.set(p.vault.address, p);
  }

  const existing = new Map<string, { id: string; chainId: number }>();
  for (const part of chunks([...byAddress.keys()], 500)) {
    for (const row of await prisma.vault.findMany({
      where: { address: { in: part } },
      select: { id: true, address: true, chainId: true },
    })) {
      existing.set(row.address, { id: row.id, chainId: row.chainId });
    }
  }

  const fields = (p: PlannedVault) => {
    const { vault, kind } = p;
    const estTotalAPR = sanitizeApyPct(vault.supplyApy ?? null);
    return {
      name: vault.name,
      curatorId: p.curatorId,
      opportunityType: kind === "earn" ? "euler-earn" : "evk",
      chainId: vault.chainId,
      chainName: canonicalChainName(vault.chainId),
      onchainAddress: vault.address.toLowerCase(),
      onchainSymbol: vault.symbol,
      estTotalAPR,
      creationTimestamp: vault.createdAt
        ? Math.floor(new Date(vault.createdAt).getTime() / 1000)
        : undefined,
      // Wound-down (non-insolvency deprecated) markets that still hold funds
      // count toward curator AUM but aren't promoted in the directory.
      listed: p.listed,
    };
  };

  const toCreate: PlannedVault[] = [];
  const toUpdate: { id: string; p: PlannedVault }[] = [];
  for (const p of byAddress.values()) {
    const row = existing.get(p.vault.address);
    if (!row) {
      toCreate.push(p);
    } else if (row.chainId !== p.vault.chainId) {
      // Same global-unique-address caveat as the Morpho pipeline: never let a
      // same-address vault on another chain clobber an existing row.
      log(`  ⚠ Address collision across chains, skipping: ${p.vault.address} (db chain ${row.chainId}, api chain ${p.vault.chainId})`);
    } else {
      toUpdate.push({ id: row.id, p });
    }
  }

  const written: { id: string; p: PlannedVault }[] = [...toUpdate];

  for (const part of chunks(toCreate, WRITE_CHUNK)) {
    const rows = await prisma.vault.createManyAndReturn({
      data: part.map((p) => {
        const f = fields(p);
        return {
          address: p.vault.address,
          symbol: p.vault.symbol,
          assetAddress: p.vault.asset?.address ?? "unknown",
          assetSymbol: p.vault.asset?.symbol ?? "UNKNOWN",
          assetDecimals: p.vault.asset?.decimals ?? 18,
          ...f,
          protocol: "euler",
          dataSource: "euler",
          netAPR: f.estTotalAPR,
          active: true,
        };
      }),
      // A row another pipeline created since the read above is left alone
      // (not clobbered); it stays in `kept`, so it is not swept either.
      skipDuplicates: true,
      select: { id: true, address: true },
    });
    const idByAddress = new Map(rows.map((r) => [r.address, r.id]));
    for (const p of part) {
      const id = idByAddress.get(p.vault.address);
      if (id) written.push({ id, p });
      else log(`  ⚠ Created concurrently by another writer, skipped: ${p.vault.address}`);
    }
  }

  // Existing rows: the old upsert's update branch, one statement per chunk.
  // creationTimestamp keeps the stored value when the API has none (the
  // upsert passed `undefined`, i.e. "leave as is").
  const now = new Date();
  for (const part of chunks(toUpdate, WRITE_CHUNK)) {
    const values = part.map(({ id, p }) => {
      const f = fields(p);
      return Prisma.sql`(${id}::text, ${f.name}::text, ${f.curatorId}::text, ${f.opportunityType}::text,
        ${f.chainId}::int, ${f.chainName}::text, ${f.onchainAddress}::text, ${f.onchainSymbol}::text,
        ${f.estTotalAPR}::double precision, ${f.creationTimestamp ?? null}::int, ${f.listed}::boolean)`;
    });
    await prisma.$executeRaw`
      UPDATE "Vault" v
      SET "name" = d.name,
          "protocol" = 'euler',
          "curatorId" = d."curatorId",
          "dataSource" = 'euler',
          "opportunityType" = d."opportunityType",
          "chainId" = d."chainId",
          "chainName" = d."chainName",
          "onchainAddress" = d."onchainAddress",
          "onchainSymbol" = d."onchainSymbol",
          "estTotalAPR" = d.apr,
          "netAPR" = d.apr,
          "creationTimestamp" = COALESCE(d."creationTimestamp", v."creationTimestamp"),
          "active" = true,
          "listed" = d.listed,
          "updatedAt" = ${now}
      FROM (VALUES ${Prisma.join(values)}) AS d(id, name, "curatorId", "opportunityType",
        "chainId", "chainName", "onchainAddress", "onchainSymbol", apr, "creationTimestamp", listed)
      WHERE v.id = d.id
    `;
  }

  for (const part of chunks(written, 500)) {
    await prisma.vaultSnapshot.createMany({
      data: part.map(({ id, p }) => {
        const estTotalAPR = sanitizeApyPct(p.vault.supplyApy ?? null);
        const aprDecimal = estTotalAPR != null ? estTotalAPR / 100 : null;
        return {
          vaultId: id,
          totalAssets: String(p.vault.totalAssets ?? "0"),
          totalAssetsUsd: p.vault.totalSupplyUsd ?? 0,
          totalSupply: "0",
          sharePrice: 1,
          apy: aprDecimal,
          netApy: aprDecimal,
          avgApy: aprDecimal,
          avgNetApy: aprDecimal,
        };
      }),
    });
  }

  // Phantom test on the RAW source APY (the stored value is sanitized).
  await recordSnapshotsWritten(
    written.map(({ id, p }) => ({
      vaultId: id,
      phantomReason: assessPhantom({
        apy: p.vault.supplyApy != null ? p.vault.supplyApy / 100 : null,
        assetSymbol: p.vault.asset?.symbol ?? "UNKNOWN",
      }),
    }))
  );

  return written.map(({ p }) => p);
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
    // ── Fetch phase: every source in parallel, one wall-clock budget ────────
    // Started before the DB reads below so the network and the DB overlap.
    const budget = AbortSignal.timeout(FETCH_BUDGET_MS);
    const settle = <T>(p: Promise<T>) =>
      p.then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error })
      );
    const turtleFetch = settle(fetchTurtleOpportunities({ signal: budget }));
    const chainFetch = mapLimit(EULER_CHAIN_IDS, CHAIN_CONCURRENCY, (chainId) =>
      settle(
        Promise.all([
          fetchEulerVaults(chainId, "evk", budget),
          fetchEulerVaults(chainId, "earn", budget),
          fetchEulerAttribution(chainId, budget),
        ])
      )
    );
    const sonicFetch = settle(fetchSonicEulerVaults(budget));

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

    // matchCurator answers the same inputs the same way within a run, but an
    // allowlisted / tc:<slug> curator costs an upsert round trip per call.
    // Memoize per run: one round trip per distinct curator, not per vault.
    const curatorMemo = new Map<string, Promise<string | null>>();
    const resolveCurator = (name: string, curatorData?: TurtleCurator) => {
      const key = JSON.stringify([name, curatorData?.name ?? null, curatorData?.landingUrl ?? null]);
      let hit = curatorMemo.get(key);
      if (!hit) {
        hit = matchCurator(name, curatorData);
        curatorMemo.set(key, hit);
      }
      return hit;
    };

    // Receipt tokens (addr:chainId) and opportunity ids the LIVE Turtle feed
    // lists. null = feed unreadable → every active Turtle row is treated as
    // live (skip, never double count).
    let liveTurtle: Set<string> | null = null;
    const turtle = await turtleFetch;
    if (turtle.ok) {
      liveTurtle = new Set<string>();
      for (const opp of turtle.value) {
        liveTurtle.add(opp.id);
        const receipt = opp.receiptToken;
        if (!receipt?.address) continue;
        const chainId = resolveChainId(receipt.chain?.chainId, receipt.chain?.slug);
        if (chainId === null) continue;
        liveTurtle.add(`${receipt.address.toLowerCase()}:${chainId}`);
      }
    } else {
      const msg = `Turtle feed unavailable for the cross-source guard: ${errorMessage(turtle.error)}`;
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
    const planned: PlannedVault[] = [];

    // Each chain independent: one chain's API trouble must not kill the run.
    const chainResults = await chainFetch;
    for (const [i, chainId] of EULER_CHAIN_IDS.entries()) {
      const chainName = canonicalChainName(chainId);
      const fetched = chainResults[i];
      try {
        if (!fetched.ok) throw fetched.error;
        const [evk, earn, labels] = fetched.value;
        const candidates: Array<{ vault: EulerApiVault; kind: "evk" | "earn" }> = [
          ...evk.map((vault) => ({ vault, kind: "evk" as const })),
          ...earn.map((vault) => ({ vault, kind: "earn" as const })),
        ];
        totalFetched += candidates.length;

        let chainPlanned = 0;
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
            curatorId = await resolveCurator(attr.productName, {
              name: attr.entityName,
              landingUrl: attr.entityUrl,
            });
          } else if (kind === "earn") {
            // (a) matchCurator's own extraction path (matches existing only);
            // (b) prefix match: the vault name must START WITH an existing
            //     curator's exact name ("TelosC Surge" → TelosC). Neither path
            //     can create a curator from a vault title.
            curatorId = await resolveCurator(vault.name);
            if (curatorId === null) {
              const vaultLower = vault.name.toLowerCase();
              const prefixHit = curatorNamesByLength.find(
                (n) =>
                  vaultLower === n.toLowerCase() ||
                  vaultLower.startsWith(n.toLowerCase() + " ")
              );
              if (prefixHit) {
                curatorId = await resolveCurator(vault.name, { name: prefixHit });
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
          planned.push({ vault, kind, curatorId, listed: true, viaName });
          chainPlanned++;
        }

        cleanChains.add(chainId);
        log(`  ${chainName}: ${candidates.length} fetched, ${chainPlanned} to write`);
      } catch (error) {
        const msg = `${chainName} failed: ${errorMessage(error)}`;
        logError(msg);
        errors.push(msg);
      }
    }

    // ── Sonic (chainId 146): v3 API doesn't serve it — read on-chain ────────
    try {
      const sonicResult = await sonicFetch;
      if (!sonicResult.ok) throw sonicResult.error;
      const sonic: SonicFetchResult = sonicResult.value;
      let sonicPlanned = 0;
      for (const vault of sonic.vaults) {
        if (vault.tvlUsd < MIN_TVL_USD) continue;

        const addressLower = vault.address.toLowerCase();
        const owner = ownerOf(`${addressLower}:146`);
        if (owner) {
          crossSourceOverlaps.push({ name: vault.name, tvl: vault.tvlUsd, address: addressLower, source: owner });
          continue;
        }

        const curatorId = await resolveCurator(vault.productName, {
          name: vault.entityName,
          landingUrl: vault.entityUrl,
        });
        if (curatorId === null) {
          skippedUnlabeled++;
          skippedUnlabeledTvlUsd += vault.tvlUsd;
          continue;
        }

        kept.add(`${addressLower}:146`);
        planned.push({
          vault: {
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
          kind: "evk",
          curatorId,
          listed: vault.listed,
          viaName: false,
        });
        sonicPlanned++;
      }
      // Sweep Sonic only on a fully readable pass: a flaky RPC must not retire
      // a funded vault.
      if (sonic.unreadable === 0) cleanChains.add(146);
      log(`  Sonic (on-chain): ${sonic.vaults.length} readable funded vaults, ${sonicPlanned} to write (${sonic.vaults.filter((v) => !v.listed).length} wound-down → listed=false)`);
      if (sonic.skippedNonStable.length > 0) {
        log(`    non-stable assets skipped (no oracle): ${sonic.skippedNonStable.map((s) => s.symbol).join(", ")}`);
      }
      log(`    insolvency-deprecated excluded: ${sonic.skippedInsolvency} · empty: ${sonic.skippedEmpty} · unreadable: ${sonic.unreadable}`);
    } catch (error) {
      const msg = `Sonic on-chain failed: ${errorMessage(error)}`;
      logError(msg);
      errors.push(msg);
    }
    log(`  Fetch + plan: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    // ── Write phase: every planned vault in one batch ───────────────────────
    try {
      const written = await writeEulerVaults(planned);
      vaultsUpserted = written.length;
      nameAttributed = written.filter((p) => p.viaName).length;
    } catch (error) {
      const msg = `Euler vault write failed (${planned.length} planned): ${errorMessage(error)}`;
      logError(msg, error);
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

    // Totals hygiene: exclusion flags, then curator stats over counted vaults.
    const hygiene = await finalizeCollection();
    log(`  Exclusion flags changed: ${hygiene.changed} (${JSON.stringify(hygiene.excludedByReason)})`);

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

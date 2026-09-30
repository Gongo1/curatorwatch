/**
 * Turtle data collection pipeline.
 * Fetches managed positions from Turtle API for cross-protocol curator coverage.
 *
 * Filters: tvl >= $100K AND protocol !== "morpho" AND not a testnet chain (all
 * opportunity types — vault / lending / staking; curators run more than vaults).
 * Morpho vaults are already covered by the primary Morpho pipeline, so excluding them
 * prevents double-counting. Opportunities that don't resolve to a curator (denylisted
 * protocols/infra, or no curator name) are skipped, not stored.
 *
 * Writes are batched (a fixed ~12 DB round trips per run, independent of the
 * number of vaults): one read of the existing rows, one curator batch, then
 * createMany / UPDATE ... FROM (VALUES ...) in chunks of 500. The per-vault
 * upsert it replaced cost 3-5 round trips per vault and hit the route's cap.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { fetchTurtleOpportunities } from "../lib/turtle/client";
import { extractProtocol } from "../lib/turtle/protocol-extractor";
import { matchCurators } from "../lib/turtle/curator-matcher";
import { resolveChainId, canonicalChainName } from "../lib/turtle/chain-mapper";
import { sanitizeApyPct } from "../lib/utils/sanitize-apy";
import { assessPhantom } from "../lib/data-quality/phantom";
import { finalizeCollection, recordSnapshotsWritten } from "../lib/data-quality/maintenance";
import type { TurtleOpportunity, TurtleToken } from "../lib/turtle/types";

const MIN_TVL_USD = 100_000; // $100K dust floor

/** TVL plausibility ceiling. Turtle has shipped raw token units in the `tvl`
 * field (Axis Origin USDx, 2026-07-28: claimed $92B ≈ 10^6× its real ~$92K —
 * USDT's 6 decimals, likely a missing USDx price feed upstream). The largest
 * genuine single opportunity in the feed is ~$4.6B (Sky Savings USDS), so $10B
 * leaves 2× headroom while catching decimals-scale garbage. Offenders are
 * skipped + reported, never stored. */
const MAX_TVL_USD = 10_000_000_000;

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
  // Opportunities whose source-reported TVL exceeds MAX_TVL_USD — skipped as
  // upstream data errors (e.g. raw token units in the tvl field), reported here.
  implausibleTvl: { name: string; tvl: number }[];
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
 * The chain an opportunity's position lives on: the RECEIPT token's chain,
 * falling back to the first deposit token's, then the opportunity's. Lido
 * wstETH lists WETH on Ethereum as the deposit token for every L2 wstETH
 * opportunity, so reading the deposit chain labeled 11 L2 rows "Ethereum"
 * (with L2 contract addresses).
 */
function opportunityChain(opp: TurtleOpportunity): TurtleToken["chain"] | undefined {
  return opp.receiptToken?.chain ?? opp.depositTokens?.[0]?.chain ?? opp.chain;
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
    const chainSlug = (opportunityChain(opp)?.slug ?? "ethereum").toLowerCase();
    if (TESTNET_CHAINS.has(chainSlug)) return false;

    return true;
  });
}

/** Rows per bulk statement (createMany / UPDATE ... FROM (VALUES ...)). */
const WRITE_CHUNK = 500;

function chunked<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += WRITE_CHUNK) out.push(rows.slice(i, i + WRITE_CHUNK));
  return out;
}

/** One opportunity that passed every guard, ready for the bulk writes. */
interface PlannedVault {
  opp: TurtleOpportunity;
  address: string; // synthetic `turtle-<opp.id>`
  vaultId: string | undefined; // existing row id up front; filled in after createMany for new rows
  fields: {
    name: string;
    turtleId: string;
    protocol: string;
    curatorId: string;
    dataSource: "turtle";
    opportunityType: string;
    chainId: number;
    chainName: string;
    onchainAddress: string | null;
    onchainSymbol: string | null;
    estTotalAPR: number | null;
    netAPR: number | null;
    aprBreakdown: { source: string; apr: number; type: string }[] | undefined;
    active: true;
  };
  createOnly: { symbol: string; assetAddress: string; assetSymbol: string; assetDecimals: number };
  aprDecimal: number | null;
  phantomReason: string | null;
}

/** Chain for an opportunity, or null when neither the numeric id nor the slug resolves. */
function resolveOppChain(opp: TurtleOpportunity): { chainId: number; chainName: string } | null {
  // Prefer Turtle's authoritative numeric chainId (present on every chain object)
  // over the slug→id map, so chains we haven't enumerated are never silently
  // mislabeled as Ethereum (chainId 1). Skip + log if neither resolves.
  const chainObj = opportunityChain(opp);
  const chainSlug = (chainObj?.slug ?? "ethereum").toLowerCase();
  const chainId = resolveChainId(chainObj?.chainId, chainSlug);
  if (chainId === null) return null;
  return { chainId, chainName: canonicalChainName(chainId, chainSlug) };
}

/**
 * Build the vault row + snapshot for one opportunity (no DB access). Same
 * fields and guards the per-row upsert wrote before the writes were batched.
 */
function planTurtleVault(
  opp: TurtleOpportunity,
  chain: { chainId: number; chainName: string },
  curatorId: string,
  existingId: string | undefined
): PlannedVault {
  const protocol = extractProtocol(opp.description, opp.name, opp.protocol);

  // Extract asset info from deposit tokens
  const depositToken = opp.depositTokens?.[0];
  const assetAddress = depositToken?.address ?? "unknown";
  const assetSymbol = depositToken?.symbol ?? "UNKNOWN";
  const assetDecimals = depositToken?.decimals ?? 18;

  // Real on-chain identity: the receipt/share token is the vault contract for
  // ERC-4626-style opportunities. Stored lowercase for cross-source joins.
  const onchainAddress = opp.receiptToken?.address?.toLowerCase() ?? null;
  const onchainSymbol = opp.receiptToken?.symbol ?? null;

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

  return {
    opp,
    // One Turtle opportunity = one vault row, keyed on the deterministic
    // synthetic address — no curator+asset+chain dedup, which wrongly collapsed
    // distinct vaults of the same curator and desynced turtleId↔address.
    address: `turtle-${opp.id}`,
    vaultId: existingId,
    // Vault-level data shared between create and update
    fields: {
      name: opp.name,
      turtleId: opp.id,
      protocol,
      curatorId,
      dataSource: "turtle",
      opportunityType: opp.type,
      chainId: chain.chainId,
      chainName: chain.chainName,
      onchainAddress,
      onchainSymbol,
      estTotalAPR,
      netAPR: estTotalAPR,
      aprBreakdown: aprBreakdown ?? undefined,
      active: true, // a vault present in the current filtered set is active
    },
    createOnly: { symbol: assetSymbol, assetAddress, assetSymbol, assetDecimals },
    // Snapshot stores APR as a decimal so yield math (tvl * netApy) still works.
    aprDecimal: estTotalAPR != null ? estTotalAPR / 100 : null,
    // Phantom test on the RAW source APR (the stored value is sanitized).
    phantomReason: assessPhantom({
      apy: opp.estimatedApr != null ? opp.estimatedApr / 100 : null,
      assetSymbol,
    }),
  };
}

/**
 * Update existing vault rows in one UPDATE ... FROM (VALUES ...) statement per
 * chunk. Writes the same fields the per-row upsert's update branch wrote; an
 * absent aprBreakdown leaves the stored one untouched (Prisma's `undefined`).
 */
async function updateExistingVaults(rows: PlannedVault[], now: Date): Promise<void> {
  for (const chunk of chunked(rows)) {
    const values = Prisma.join(
      chunk.map((r) => {
        const f = r.fields;
        return Prisma.sql`(${r.vaultId}::text, ${f.name}::text, ${f.turtleId}::text,
          ${f.protocol}::text, ${f.curatorId}::text, ${f.opportunityType}::text,
          ${f.chainId}::int, ${f.chainName}::text, ${f.onchainAddress}::text,
          ${f.onchainSymbol}::text, ${f.estTotalAPR}::float8,
          ${f.aprBreakdown ? JSON.stringify(f.aprBreakdown) : null}::jsonb)`;
      })
    );
    await prisma.$executeRaw`
      UPDATE "Vault" AS v
      SET "name" = d.name,
          "turtleId" = d.turtle_id,
          "protocol" = d.protocol,
          "curatorId" = d.curator_id,
          "dataSource" = 'turtle',
          "opportunityType" = d.opportunity_type,
          "chainId" = d.chain_id,
          "chainName" = d.chain_name,
          "onchainAddress" = d.onchain_address,
          "onchainSymbol" = d.onchain_symbol,
          "estTotalAPR" = d.apr,
          "netAPR" = d.apr,
          "aprBreakdown" = COALESCE(d.apr_breakdown, v."aprBreakdown"),
          "active" = true,
          "updatedAt" = ${now}
      FROM (VALUES ${values}) AS d(id, name, turtle_id, protocol, curator_id,
        opportunity_type, chain_id, chain_name, onchain_address, onchain_symbol,
        apr, apr_breakdown)
      WHERE v.id = d.id
    `;
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

    // Snapshot of vault identities owned by the native pipelines (Morpho,
    // Euler and Upshift rows store the real contract in `address`) for the
    // cross-source guard. Built once per run.
    const morphoVaults = await prisma.vault.findMany({
      where: { dataSource: { in: ["morpho", "euler", "upshift"] } },
      select: { address: true, chainId: true },
    });
    const morphoVaultKeys = new Set(
      morphoVaults.map((v) => `${v.address.toLowerCase()}:${v.chainId}`)
    );

    // Rows the funds pipeline adopted keep their synthetic turtle-<uuid>
    // address but are fund-owned now: their NAV comes from the fund source,
    // and this collector must not overwrite it with opportunity TVL.
    const adoptedRows = await prisma.vault.findMany({
      where: { dataSource: "fund", address: { startsWith: "turtle-" } },
      select: { address: true },
    });
    const fundAdopted = new Set(adoptedRows.map((v) => v.address));
    let fundAdoptedSkipped = 0;

    // Fund share tokens, matched by address on ANY chain: tokenized funds
    // (Centrifuge hub-and-spoke) deploy the same share-token address across
    // chains, and every instance is the same fund — a per-chain Turtle row
    // would double-count NAV the fund row already carries.
    const fundRows = await prisma.vault.findMany({
      where: { dataSource: "fund", onchainAddress: { not: null } },
      select: { onchainAddress: true },
    });
    const fundAddresses = new Set(fundRows.map((v) => v.onchainAddress!));

    // Existing rows keyed by synthetic address, so the writes below need no
    // per-vault lookup (the upsert used to be keyed on this address).
    const existingRows = await prisma.vault.findMany({
      where: { address: { startsWith: "turtle-" } },
      select: { id: true, address: true },
    });
    const existingIdByAddress = new Map(existingRows.map((v) => [v.address, v.id]));

    // 3. Plan every vault in memory, then write in bulk.
    let vaultsUpserted = 0;
    let snapshotsCreated = 0;
    let vaultsAttributed = 0;
    // "hiddenVaults" now holds opportunities SKIPPED (not stored) because they didn't
    // resolve to a curator — denylisted protocols/infra, or no curator name.
    const hiddenVaults: { name: string; tvl: number }[] = [];
    const implausibleTvl: TurtleCollectionResult["implausibleTvl"] = [];
    const crossSourceOverlaps: TurtleCollectionResult["crossSourceOverlaps"] = [];

    // 3a. Source guards + chain resolution.
    const candidates: { opp: TurtleOpportunity; chain: { chainId: number; chainName: string } }[] = [];
    for (const opp of filtered) {
      if (fundAdopted.has(`turtle-${opp.id}`)) {
        fundAdoptedSkipped++;
        continue;
      }
      // TVL plausibility guard (sibling of the APY guard on the write path):
      // source-claimed TVL above the ceiling is an upstream data error — skip
      // the opportunity entirely so it never reaches a vault row or snapshot.
      if ((opp.tvl ?? 0) > MAX_TVL_USD) {
        implausibleTvl.push({ name: opp.name, tvl: opp.tvl ?? 0 });
        logError(
          `Implausible TVL from source — skipping ${opp.name}: claims $${((opp.tvl ?? 0) / 1e9).toFixed(1)}B (ceiling $${MAX_TVL_USD / 1e9}B)`
        );
        continue;
      }
      const chain = resolveOppChain(opp);
      if (chain === null) {
        // Unknown chain (no numeric id, unmapped slug): skipped, not stored.
        hiddenVaults.push({ name: opp.curator?.name ?? opp.name, tvl: opp.tvl ?? 0 });
        continue;
      }
      candidates.push({ opp, chain });
    }

    // 3b. Resolve curators (name-based; Turtle gives no address) in one batch.
    // null = denylisted protocol/infra or no curator name.
    const curatorIds = await matchCurators(
      candidates.map(({ opp }) => ({ opportunityName: opp.name, curatorData: opp.curator }))
    );

    const planned: PlannedVault[] = [];
    candidates.forEach(({ opp, chain }, i) => {
      const curatorId = curatorIds[i];
      // Only ingest opportunities that resolve to a curator — skip the rest (don't
      // store hidden rows), keeping the vault table clean under the broadened filter.
      if (curatorId === null) {
        hiddenVaults.push({ name: opp.curator?.name ?? opp.name, tvl: opp.tvl ?? 0 });
        return;
      }
      const address = `turtle-${opp.id}`;
      const existingId = existingIdByAddress.get(address);

      // Cross-source guard: if a native pipeline (Morpho, Euler, Upshift, funds)
      // already tracks this exact vault (same on-chain address + chain), don't
      // create a second row for it. If a Turtle row already exists from before,
      // keep refreshing it and flag the overlap in the run report; the exclusion
      // rules mark it cross_source_dup (not counted) while the native row is
      // fresh — never auto-unlinked (no silent drops).
      const onchainAddress = opp.receiptToken?.address?.toLowerCase() ?? null;
      const isOverlap =
        onchainAddress !== null &&
        (morphoVaultKeys.has(`${onchainAddress}:${chain.chainId}`) ||
          fundAddresses.has(onchainAddress));
      if (isOverlap) {
        crossSourceOverlaps.push({
          name: opp.name,
          tvl: opp.tvl ?? 0,
          onchainAddress,
          existingRow: existingId !== undefined,
        });
        if (existingId === undefined) return;
      }
      planned.push(planTurtleVault(opp, chain, curatorId, existingId));
    });

    // 3c. Bulk writes: create new rows, update existing ones, then snapshots
    // and the lastSnapshotAt / phantom stamp. A failed statement throws and
    // fails the run (caught below), never a silent partial success.
    const now = new Date();
    const toCreate = planned.filter((p) => p.vaultId === undefined);
    const toUpdate = planned.filter((p) => p.vaultId !== undefined);

    for (const chunk of chunked(toCreate)) {
      await prisma.vault.createMany({
        data: chunk.map((p) => ({ address: p.address, ...p.createOnly, ...p.fields })),
        skipDuplicates: true,
      });
    }
    if (toCreate.length > 0) {
      const created = await prisma.vault.findMany({
        where: { address: { in: toCreate.map((p) => p.address) } },
        select: { id: true, address: true },
      });
      const createdId = new Map(created.map((v) => [v.address, v.id]));
      for (const p of toCreate) p.vaultId = createdId.get(p.address);
    }
    await updateExistingVaults(toUpdate, now);

    // A new row can be missing only if the insert hit another unique key
    // (turtleId) — report it like the per-row upsert's error used to.
    const written: PlannedVault[] = [];
    for (const p of planned) {
      if (p.vaultId === undefined) {
        const msg = `${p.opp.name}: vault row not created (unique conflict on turtleId ${p.opp.id})`;
        errors.push(msg);
        logError(msg);
      } else {
        written.push(p);
      }
    }

    for (const chunk of chunked(written)) {
      const res = await prisma.vaultSnapshot.createMany({
        data: chunk.map((p) => ({
          vaultId: p.vaultId!,
          totalAssets: "0",
          totalAssetsUsd: p.opp.tvl,
          totalSupply: "0",
          sharePrice: 1,
          apy: p.aprDecimal,
          netApy: p.aprDecimal,
          avgApy: p.aprDecimal,
          avgNetApy: p.aprDecimal,
        })),
      });
      snapshotsCreated += res.count;
    }
    await recordSnapshotsWritten(
      written.map((p) => ({ vaultId: p.vaultId!, phantomReason: p.phantomReason }))
    );
    vaultsUpserted = written.length;
    vaultsAttributed = written.length;
    const unmatchedHidden = hiddenVaults.length;

    if (crossSourceOverlaps.length > 0) {
      log(`  ⚠ Cross-source overlaps (same vault also tracked by the Morpho pipeline): ${crossSourceOverlaps.length}`);
      for (const o of crossSourceOverlaps.slice(0, 10)) {
        log(
          `    ${o.name} (${o.onchainAddress}, $${(o.tvl / 1e6).toFixed(1)}M) — ${o.existingRow ? "EXISTING Turtle row, review & merge" : "new, skipped"}`
        );
      }
    }

    // 4. Totals hygiene (exclusion flags incl. cross-source duplicates of
    // existing Turtle rows), then curator stats over counted vaults.
    const hygiene = await finalizeCollection();
    log(`  Exclusion flags changed: ${hygiene.changed} (${JSON.stringify(hygiene.excludedByReason)})`);

    const duration = Date.now() - startTime;

    log("-".repeat(60));
    log("Turtle collection completed!");
    log(`  Total fetched: ${allOpportunities.length}`);
    log(`  Filtered: ${filtered.length}`);
    log(`  Vaults upserted: ${vaultsUpserted}`);
    log(`  Snapshots created: ${snapshotsCreated}`);
    log(`  Attributed to a curator: ${vaultsAttributed}`);
    log(`  Skipped (unresolved — denylisted protocols / no curator): ${unmatchedHidden}`);
    if (implausibleTvl.length > 0) {
      log(`  ⚠ Skipped (implausible source TVL > $${MAX_TVL_USD / 1e9}B): ${implausibleTvl.length}`);
      for (const o of implausibleTvl.slice(0, 10)) {
        log(`    ${o.name} — claimed $${(o.tvl / 1e9).toFixed(1)}B`);
      }
    }
    if (fundAdoptedSkipped > 0) {
      log(`  Skipped (adopted by the funds pipeline): ${fundAdoptedSkipped}`);
    }
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
      implausibleTvl,
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
      implausibleTvl: [],
      crossSourceOverlaps: [],
      errors,
      duration: Date.now() - startTime,
    };
  }
}

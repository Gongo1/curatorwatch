/**
 * Tokenized-funds collection pipeline (P3 of the coverage roadmap).
 *
 * Ingests registered tokenized funds as a SEPARATE SEGMENT
 * (opportunityType "tokenized-fund", dataSource "fund"): Centrifuge pools
 * (Janus Henderson/Anemoy JTRSY, JAAA, S&P 500, Apollo credit) at pool-level
 * NAV, plus on-chain constant-NAV funds with no API (JPM's JLTXX on Kinexys).
 * Fund rows are excluded from the DeFi vault grading model (see
 * update-vault-grades) but count toward curator AUM — that's the point:
 * Janus Henderson's real complex is ~$1.6B, not the Turtle-routed $16M.
 *
 * Share-class dedup by construction: one row per (pool, token) at pool NAV;
 * per-chain token instances and deRWA wrapper pools are never separate rows.
 *
 * Adoption: where a Turtle row already tracks one of the fund's share tokens
 * (receipt token match), that row is UPGRADED in place — dataSource "fund",
 * fund-level NAV — keeping its turtleId and deal-mapping fields so the
 * deposit flow keeps working. Sibling share-class rows are unlinked
 * (active=false, curatorId=null) and reported, never deleted. The Turtle
 * collector skips fund-adopted rows on subsequent runs.
 *
 * Attribution is source-derived: pool/token names prefix-match EXISTING
 * curators only ("Janus Henderson Anemoy…" → Janus Henderson); unmatched
 * pools are skipped and reported. The only hand-authored entries are the
 * ONCHAIN_FUNDS configs (JLTXX), where no API exists at all.
 */

import { prisma } from "../lib/db";
import {
  fetchCentrifugePools,
  poolTokenNavUsd,
  isWrapperPool,
  readOnchainFundTvl,
  ONCHAIN_FUNDS,
  type CentrifugePool,
  type CentrifugeToken,
} from "../lib/funds/client";
import { matchCurator } from "../lib/turtle/curator-matcher";
import { canonicalChainName } from "../lib/turtle/chain-mapper";
import { finalizeCollection, recordSnapshotWritten } from "../lib/data-quality/maintenance";

const MIN_TVL_USD = 50_000;

export interface FundsCollectionResult {
  success: boolean;
  fundsUpserted: number;
  snapshotsCreated: number;
  adoptedTurtleRows: number;
  siblingsUnlinked: { name: string; address: string }[];
  skippedWrappers: number;
  skippedUnattributed: { name: string; tvl: number }[];
  errors: string[];
  duration: number;
}

function log(message: string) {
  console.log(`[${new Date().toISOString()}] [FUNDS] ${message}`);
}

function logError(message: string, error?: unknown) {
  console.error(`[${new Date().toISOString()}] [FUNDS] ERROR: ${message}`, error ?? "");
}

/** Prefix-match a fund's pool/token names against existing curator names. */
function findCuratorNamePrefix(
  candidates: string[],
  curatorNamesByLength: string[]
): string | null {
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const hit = curatorNamesByLength.find(
      (n) => lower === n.toLowerCase() || lower.startsWith(n.toLowerCase() + " ")
    );
    if (hit) return hit;
  }
  return null;
}

interface FundRecord {
  name: string;
  symbol: string;
  canonicalAddress: string; // real on-chain share-token address on canonicalChainId
  canonicalChainId: number;
  allInstances: { address: string; chainId: number }[]; // for adoption matching
  tvlUsd: number;
  protocol: string;
  curatorId: string;
}

async function upsertFund(fund: FundRecord): Promise<{
  adopted: boolean;
  siblingsUnlinked: { name: string; address: string }[];
  error?: string;
}> {
  const siblingsUnlinked: { name: string; address: string }[] = [];
  try {
    const chainName = canonicalChainName(fund.canonicalChainId);
    const instanceKeys = new Set(
      fund.allInstances.map((i) => `${i.address.toLowerCase()}:${i.chainId}`)
    );

    // Rows that already track any share token of this fund (fund row from a
    // previous run, or Turtle rows via receipt token).
    const candidates = await prisma.vault.findMany({
      where: {
        OR: [
          { onchainAddress: { in: fund.allInstances.map((i) => i.address.toLowerCase()) } },
          { address: { in: fund.allInstances.map((i) => i.address) } },
          { address: fund.canonicalAddress },
        ],
      },
      select: { id: true, address: true, name: true, chainId: true, onchainAddress: true, dataSource: true },
    });
    const matching = candidates.filter((v) => {
      const key = `${(v.onchainAddress ?? v.address).toLowerCase()}:${v.chainId}`;
      return instanceKeys.has(key);
    });

    // Pick the row to own the fund: an existing fund row first, else a Turtle
    // row to adopt (keeps deal mapping), else create fresh.
    const owner =
      matching.find((v) => v.dataSource === "fund") ??
      matching.find((v) => v.dataSource === "turtle") ??
      null;

    const fundFields = {
      name: fund.name,
      symbol: fund.symbol,
      protocol: fund.protocol,
      curatorId: fund.curatorId,
      dataSource: "fund" as const,
      opportunityType: "tokenized-fund",
      chainId: fund.canonicalChainId,
      chainName,
      onchainAddress: fund.canonicalAddress.toLowerCase(),
      onchainSymbol: fund.symbol,
      // Fund yield is distribution/NAV-accrual based; no honest APR from these
      // sources yet — null rather than a guess. (P7 derives it from our own
      // snapshot history once it accumulates.)
      estTotalAPR: null,
      netAPR: null,
      active: true,
      listed: true,
    };

    let vaultId: string;
    let adopted = false;
    if (owner) {
      await prisma.vault.update({
        where: { id: owner.id },
        data: { ...fundFields, updatedAt: new Date() },
      });
      vaultId = owner.id;
      adopted = owner.dataSource === "turtle";
    } else {
      const created = await prisma.vault.create({
        data: {
          address: fund.canonicalAddress,
          assetAddress: "unknown",
          assetSymbol: "USD",
          assetDecimals: 6,
          ...fundFields,
        },
      });
      vaultId = created.id;
    }

    // Sibling share-class rows (other Turtle rows on the same fund) would
    // double-count the pool NAV — unlink from the curator and hide, loudly.
    for (const sibling of matching) {
      if (sibling.id === vaultId || sibling.dataSource !== "turtle") continue;
      await prisma.vault.update({
        where: { id: sibling.id },
        data: { active: false, listed: false, curatorId: null, updatedAt: new Date() },
      });
      siblingsUnlinked.push({ name: sibling.name, address: sibling.address });
      log(`  ⚠ Unlinked sibling share-class row: ${sibling.name} (${sibling.address}) — NAV now carried by ${fund.symbol}`);
    }

    await prisma.vaultSnapshot.create({
      data: {
        vaultId,
        totalAssets: "0",
        totalAssetsUsd: fund.tvlUsd,
        totalSupply: "0",
        sharePrice: 1,
        apy: null,
        netApy: null,
        avgApy: null,
        avgNetApy: null,
      },
    });
    // No APY or share-price data from fund sources: nothing to test for
    // phantom accrual, just stamp freshness.
    await recordSnapshotWritten(vaultId, null);

    return { adopted, siblingsUnlinked };
  } catch (error) {
    return {
      adopted: false,
      siblingsUnlinked,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function collectFundsData(): Promise<FundsCollectionResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  log("=".repeat(60));
  log("Starting tokenized-funds collection...");

  let fundsUpserted = 0;
  let adoptedTurtleRows = 0;
  let skippedWrappers = 0;
  const siblingsUnlinked: FundsCollectionResult["siblingsUnlinked"] = [];
  const skippedUnattributed: FundsCollectionResult["skippedUnattributed"] = [];

  try {
    const curatorNameRows = await prisma.curator.findMany({
      where: { name: { not: null } },
      select: { name: true },
    });
    const curatorNamesByLength = curatorNameRows
      .map((c) => c.name!.trim())
      .filter((n) => n.length >= 4)
      .sort((a, b) => b.length - a.length);

    // ── Centrifuge pools ────────────────────────────────────────────────────
    try {
      const pools = await fetchCentrifugePools();
      log(`Centrifuge: ${pools.length} pools fetched`);

      // deRWA wrapper instances, keyed by the parent's token symbol (pool name
      // "JAAA deRWA" → parent JAAA). Wrapper tokens are what DeFi integrations
      // (incl. Turtle deposits) actually hold, so the parent fund's adoption
      // matching must recognize them — otherwise the old Turtle rows survive
      // as double-count next to the fund row.
      const wrapperInstancesByParent = new Map<string, { address: string; chainId: number }[]>();
      for (const pool of pools) {
        if (!pool.name || !isWrapperPool(pool)) continue;
        const parentSymbol = pool.name.replace(/\s*deRWA\s*$/i, "").trim();
        if (!parentSymbol) continue;
        const instances = pool.tokens.items.flatMap((t) =>
          t.tokenInstances.items
            .map((i) => ({ address: i.address, chainId: Number(i.blockchain?.id) }))
            .filter((i) => Number.isFinite(i.chainId) && i.chainId > 0)
        );
        wrapperInstancesByParent.set(
          parentSymbol,
          [...(wrapperInstancesByParent.get(parentSymbol) ?? []), ...instances]
        );
      }

      for (const pool of pools) {
        if (!pool.isActive || !pool.name) continue;
        if (isWrapperPool(pool)) {
          skippedWrappers++;
          continue;
        }
        for (const token of pool.tokens.items) {
          const tvlUsd = poolTokenNavUsd(pool, token);
          if (tvlUsd < MIN_TVL_USD) continue;

          const prefixHit = findCuratorNamePrefix(
            [pool.name, token.name],
            curatorNamesByLength
          );
          const curatorId = prefixHit
            ? await matchCurator(pool.name, { name: prefixHit })
            : null;
          if (!curatorId) {
            skippedUnattributed.push({ name: `${pool.name} (${token.symbol})`, tvl: tvlUsd });
            continue;
          }

          const instances = token.tokenInstances.items
            .map((i) => ({
              address: i.address,
              chainId: Number(i.blockchain?.id),
              issuance: Number(i.totalIssuance) || 0,
            }))
            .filter((i) => Number.isFinite(i.chainId) && i.chainId > 0);
          if (instances.length === 0) continue;
          const canonical =
            instances.find((i) => i.chainId === 1) ??
            [...instances].sort((a, b) => b.issuance - a.issuance)[0];

          // Own share classes + deRWA wrapper instances of this fund
          const allInstances = [
            ...instances,
            ...(wrapperInstancesByParent.get(token.symbol) ?? []),
          ];

          const result = await upsertFund({
            name: pool.name,
            symbol: token.symbol,
            canonicalAddress: canonical.address,
            canonicalChainId: canonical.chainId,
            allInstances,
            tvlUsd,
            protocol: "centrifuge",
            curatorId,
          });
          if (result.error) {
            errors.push(`${pool.name}: ${result.error}`);
            logError(`Failed to upsert ${pool.name}: ${result.error}`);
          } else {
            fundsUpserted++;
            if (result.adopted) adoptedTurtleRows++;
            siblingsUnlinked.push(...result.siblingsUnlinked);
            log(`  ${token.symbol}: $${(tvlUsd / 1e6).toFixed(1)}M (${prefixHit})${result.adopted ? " [adopted Turtle row]" : ""}`);
          }
        }
      }
    } catch (error) {
      const msg = `Centrifuge failed: ${error instanceof Error ? error.message : error}`;
      logError(msg);
      errors.push(msg);
    }

    // ── On-chain constant-NAV funds (JLTXX) ─────────────────────────────────
    for (const fund of ONCHAIN_FUNDS) {
      try {
        const { tvlUsd } = await readOnchainFundTvl(fund);
        if (tvlUsd < MIN_TVL_USD) continue;
        const curatorId = await matchCurator(fund.name, {
          name: fund.curatorName,
          landingUrl: fund.website,
        });
        if (!curatorId) {
          skippedUnattributed.push({ name: fund.name, tvl: tvlUsd });
          continue;
        }
        const result = await upsertFund({
          name: fund.name,
          symbol: fund.symbol,
          canonicalAddress: fund.address,
          canonicalChainId: fund.chainId,
          allInstances: [{ address: fund.address, chainId: fund.chainId }],
          tvlUsd,
          protocol: fund.protocol,
          curatorId,
        });
        if (result.error) {
          errors.push(`${fund.symbol}: ${result.error}`);
        } else {
          fundsUpserted++;
          log(`  ${fund.symbol}: $${(tvlUsd / 1e6).toFixed(1)}M (${fund.curatorName})`);
        }
      } catch (error) {
        const msg = `${fund.symbol} failed: ${error instanceof Error ? error.message : error}`;
        logError(msg);
        errors.push(msg);
      }
    }

    // Totals hygiene: exclusion flags, then curator stats over counted vaults.
    const hygiene = await finalizeCollection();
    log(`  Exclusion flags changed: ${hygiene.changed} (${JSON.stringify(hygiene.excludedByReason)})`);

    const duration = Date.now() - startTime;
    log("-".repeat(60));
    log("Tokenized-funds collection completed!");
    log(`  Funds upserted: ${fundsUpserted} (${adoptedTurtleRows} adopted Turtle rows)`);
    log(`  Sibling share-class rows unlinked: ${siblingsUnlinked.length}`);
    log(`  Wrapper pools skipped (deRWA): ${skippedWrappers}`);
    log(`  Unattributed skipped: ${skippedUnattributed.length}`);
    for (const s of skippedUnattributed.slice(0, 10)) {
      log(`    ${s.name} ($${(s.tvl / 1e6).toFixed(1)}M)`);
    }
    log(`  Errors: ${errors.length}`);
    log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    log("=".repeat(60));

    return {
      success: errors.length === 0,
      fundsUpserted,
      snapshotsCreated: fundsUpserted,
      adoptedTurtleRows,
      siblingsUnlinked,
      skippedWrappers,
      skippedUnattributed,
      errors,
      duration,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logError("Critical error during funds collection", error);
    errors.push(msg);
    return {
      success: false,
      fundsUpserted,
      snapshotsCreated: fundsUpserted,
      adoptedTurtleRows,
      siblingsUnlinked,
      skippedWrappers,
      skippedUnattributed,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

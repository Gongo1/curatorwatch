/**
 * READ-ONLY preview of what Euler ingestion would add.
 *
 * Fetches every Euler chain (EVK + Earn) through the collector's own fetch
 * paths and applies the same policy: labels attribution, Earn name-match
 * fallback, deprecated-market exclusion, $50k floor, cross-source guard
 * (DB rows + live Turtle receipt tokens). Writes nothing.
 *
 * Note: the real collector resolves names via matchCurator (which may create
 * a `tc:<slug>` curator for new labels entities); this preview approximates
 * the Earn name fallback with a case-insensitive match against existing
 * curator names, so its numbers are a slight UNDER-estimate.
 *
 * Usage: npx tsx src/scripts/preview-euler.ts
 */

import { prisma } from "../lib/db";
import {
  EULER_CHAIN_IDS,
  fetchEulerVaults,
  fetchEulerAttribution,
} from "../lib/euler/client";
import { fetchTurtleOpportunities } from "../lib/turtle/client";
import { resolveChainId, canonicalChainName } from "../lib/turtle/chain-mapper";
import { extractCuratorFromVaultName } from "../lib/utils/extract-curator-name";

const MIN_TVL_USD = 50_000;

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

async function main() {
  const foreign = await prisma.vault.findMany({
    where: { dataSource: { not: "euler" } },
    select: { address: true, onchainAddress: true, chainId: true, dataSource: true },
  });
  const foreignKeys = new Map<string, string>();
  for (const v of foreign) {
    foreignKeys.set(`${v.address.toLowerCase()}:${v.chainId}`, v.dataSource);
    if (v.onchainAddress) foreignKeys.set(`${v.onchainAddress}:${v.chainId}`, v.dataSource);
  }

  // Live Turtle receipt tokens — same belt-and-braces guard the collector uses
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
  } catch (e) {
    console.log(`(turtle feed unavailable for guard: ${e instanceof Error ? e.message : e})`);
  }
  console.log(`Guard set: ${foreignKeys.size} foreign vault identities\n`);

  const existingCurators = await prisma.curator.findMany({ select: { name: true } });
  const curatorNames = new Set(
    existingCurators.map((c) => c.name?.toLowerCase().trim()).filter(Boolean)
  );
  const curatorNamesByLength = existingCurators
    .map((c) => c.name?.trim() ?? "")
    .filter((n) => n.length >= 4)
    .sort((a, b) => b.length - a.length);

  let totalNew = 0;
  let totalNewTvl = 0;
  let totalNameFallback = 0;
  let totalUnattributed = 0;
  let totalUnattributedTvl = 0;
  let totalDeprecated = 0;
  const overlaps: string[] = [];
  const entities = new Map<string, { n: number; tvl: number }>();

  for (const chainId of EULER_CHAIN_IDS) {
    const chainName = canonicalChainName(chainId);
    try {
      const [evk, earn, labels] = await Promise.all([
        fetchEulerVaults(chainId, "evk"),
        fetchEulerVaults(chainId, "earn"),
        fetchEulerAttribution(chainId),
      ]);
      const candidates = [
        ...evk.map((vault) => ({ vault, kind: "evk" as const })),
        ...earn.map((vault) => ({ vault, kind: "earn" as const })),
      ].filter(({ vault }) => (vault.totalSupplyUsd ?? 0) >= MIN_TVL_USD);

      const rows: { name: string; tvl: number; entity: string; viaName: boolean }[] = [];
      let unattributed = 0;
      let unattributedTvl = 0;

      for (const { vault, kind } of candidates) {
        const addr = vault.address.toLowerCase();
        if (labels.deprecated.has(addr)) {
          totalDeprecated++;
          continue;
        }
        const owner = foreignKeys.get(`${addr}:${vault.chainId}`);
        if (owner) {
          overlaps.push(`${vault.name} (${chainName}, ${fmtUsd(vault.totalSupplyUsd ?? 0)}) — owned by ${owner}`);
          continue;
        }
        const attr = labels.attribution.get(addr);
        let entity: string | null = attr?.entityName ?? null;
        let viaName = false;
        if (!entity && kind === "earn") {
          const extracted = extractCuratorFromVaultName(vault.name);
          if (extracted && curatorNames.has(extracted.toLowerCase().trim())) {
            entity = extracted;
            viaName = true;
          } else {
            const vaultLower = vault.name.toLowerCase();
            const prefixHit = curatorNamesByLength.find(
              (n) => vaultLower === n.toLowerCase() || vaultLower.startsWith(n.toLowerCase() + " ")
            );
            if (prefixHit) {
              entity = prefixHit;
              viaName = true;
            }
          }
        }
        if (!entity) {
          unattributed++;
          unattributedTvl += vault.totalSupplyUsd ?? 0;
          continue;
        }
        rows.push({ name: vault.name, tvl: vault.totalSupplyUsd ?? 0, entity, viaName });
        if (viaName) totalNameFallback++;
        const e = entities.get(entity) ?? { n: 0, tvl: 0 };
        e.n++;
        e.tvl += vault.totalSupplyUsd ?? 0;
        entities.set(entity, e);
      }

      const tvl = rows.reduce((s, r) => s + r.tvl, 0);
      totalNew += rows.length;
      totalNewTvl += tvl;
      totalUnattributed += unattributed;
      totalUnattributedTvl += unattributedTvl;

      if (candidates.length === 0) continue;
      console.log(
        `${chainName}: ${candidates.length} ≥floor → ${rows.length} new attributed (${fmtUsd(tvl)}), ${unattributed} unattributed (${fmtUsd(unattributedTvl)})`
      );
      for (const r of rows.sort((a, b) => b.tvl - a.tvl).slice(0, 5)) {
        console.log(`    + ${r.name} — ${fmtUsd(r.tvl)} — ${r.entity}${r.viaName ? " (name-match)" : ""}`);
      }
    } catch (e) {
      console.log(`${chainName}: FAILED — ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nTOTAL new attributed: ${totalNew} vaults, ${fmtUsd(totalNewTvl)} (${totalNameFallback} via Earn name-match)`);
  console.log(`Unattributed ≥floor (skipped, reported): ${totalUnattributed} vaults, ${fmtUsd(totalUnattributedTvl)}`);
  console.log(`Deprecated markets excluded: ${totalDeprecated}`);
  console.log(`Cross-source overlaps (${overlaps.length}):`);
  for (const o of overlaps.slice(0, 20)) console.log(`  ${o}`);
  console.log(`\nBy entity:`);
  for (const [name, e] of [...entities.entries()].sort((a, b) => b[1].tvl - a[1].tvl)) {
    console.log(`  ${name}: ${e.n} vaults, ${fmtUsd(e.tvl)}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

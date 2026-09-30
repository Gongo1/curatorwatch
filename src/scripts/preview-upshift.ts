/**
 * READ-ONLY preview of what Upshift ingestion would add.
 *
 * Fetches the platform payload through the collector's own path and applies
 * the same policy (listed+active, EVM chains, $50k floor, strategist
 * attribution, cross-source guard incl. live Turtle receipt tokens). The
 * strategist match is approximated against existing curator names (the real
 * collector may additionally create tc:<slug> rows for new strategists, so
 * this is a slight under-estimate of attribution). Writes nothing.
 *
 * Usage: npx tsx src/scripts/preview-upshift.ts
 */

import { prisma } from "../lib/db";
import { fetchUpshiftVaults, isEvmAddress } from "../lib/upshift/client";
import { fetchTurtleOpportunities } from "../lib/turtle/client";
import { resolveChainId, canonicalChainName, getChainNameById } from "../lib/turtle/chain-mapper";

const MIN_TVL_USD = 50_000;

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

async function main() {
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
      const r = opp.receiptToken;
      if (!r?.address) continue;
      const chainId = resolveChainId(r.chain?.chainId, r.chain?.slug);
      if (chainId === null) continue;
      const key = `${r.address.toLowerCase()}:${chainId}`;
      if (!foreignKeys.has(key)) foreignKeys.set(key, "turtle (live feed)");
    }
  } catch (e) {
    console.log(`(turtle feed unavailable: ${e instanceof Error ? e.message : e})`);
  }

  const existing = await prisma.curator.findMany({ where: { name: { not: null } }, select: { name: true } });
  const existingNames = new Set(existing.map((c) => c.name!.toLowerCase().trim()));

  const vaults = await fetchUpshiftVaults();
  console.log(`Fetched ${vaults.length} platform vaults\n`);

  let newCount = 0;
  let newTvl = 0;
  let hiddenTvl = 0;
  let nonEvmTvl = 0;
  const overlaps: string[] = [];
  const unattributed: string[] = [];
  const byStrategist = new Map<string, { n: number; tvl: number; isNew: boolean }>();

  for (const v of vaults) {
    const tvl = v.tvlUsd;
    if (tvl < MIN_TVL_USD) continue;
    if (v.status !== "active") {
      hiddenTvl += tvl;
      continue;
    }
    if (!isEvmAddress(v.address) || getChainNameById(v.chainId) === "Unknown") {
      nonEvmTvl += tvl;
      continue;
    }
    const owner = foreignKeys.get(`${v.address.toLowerCase()}:${v.chainId}`);
    if (owner) {
      overlaps.push(`${v.name} (${fmtUsd(tvl)}) — owned by ${owner}`);
      continue;
    }
    const strategist = v.strategistName;
    if (!strategist) {
      unattributed.push(`${v.name} (${fmtUsd(tvl)})`);
      continue;
    }
    newCount++;
    newTvl += tvl;
    const rec = byStrategist.get(strategist) ?? {
      n: 0,
      tvl: 0,
      isNew: !existingNames.has(strategist.toLowerCase().trim()),
    };
    rec.n++;
    rec.tvl += tvl;
    byStrategist.set(strategist, rec);
    console.log(`+ ${v.name} — ${fmtUsd(tvl)} — ${strategist} — ${canonicalChainName(v.chainId)} — apy ${v.apy?.toFixed(2) ?? "—"}%`);
  }

  console.log(`\nTOTAL new: ${newCount} vaults, ${fmtUsd(newTvl)}`);
  console.log(`Hidden/inactive skipped: ${fmtUsd(hiddenTvl)} | non-EVM skipped: ${fmtUsd(nonEvmTvl)}`);
  console.log(`Unattributed (${unattributed.length}): ${unattributed.slice(0, 5).join("; ")}`);
  console.log(`Overlaps (${overlaps.length}):`);
  for (const o of overlaps) console.log(`  ${o}`);
  console.log(`\nBy strategist:`);
  for (const [name, r] of [...byStrategist.entries()].sort((a, b) => b[1].tvl - a[1].tvl)) {
    console.log(`  ${name}: ${r.n} vaults, ${fmtUsd(r.tvl)}${r.isNew ? "  [NEW curator row]" : ""}`);
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

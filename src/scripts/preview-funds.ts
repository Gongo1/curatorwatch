/**
 * READ-ONLY preview of what the tokenized-funds pipeline would do.
 *
 * Fetches Centrifuge pools + on-chain fund reads through the collector's own
 * paths, applies the same policy (wrapper skip, $50k floor, prefix
 * attribution against existing curators), and reports which existing rows
 * would be ADOPTED or UNLINKED as share-class siblings. Writes nothing.
 *
 * Usage: npx tsx src/scripts/preview-funds.ts
 */

import { prisma } from "../lib/db";
import {
  fetchCentrifugePools,
  poolTokenNavUsd,
  isWrapperPool,
  readOnchainFundTvl,
  ONCHAIN_FUNDS,
} from "../lib/funds/client";
import { fetchTurtleOpportunities } from "../lib/turtle/client";
import { resolveChainId } from "../lib/turtle/chain-mapper";

const MIN_TVL_USD = 50_000;

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

async function main() {
  const curators = await prisma.curator.findMany({
    where: { name: { not: null } },
    select: { name: true },
  });
  const curatorNamesByLength = curators
    .map((c) => c.name!.trim())
    .filter((n) => n.length >= 4)
    .sort((a, b) => b.length - a.length);

  const prefixHit = (candidates: string[]) => {
    for (const c of candidates) {
      const lower = c.toLowerCase();
      const hit = curatorNamesByLength.find(
        (n) => lower === n.toLowerCase() || lower.startsWith(n.toLowerCase() + " ")
      );
      if (hit) return hit;
    }
    return null;
  };

  // Live Turtle feed receipt tokens — shows which fund instances Turtle
  // currently lists (the rows the collector would adopt after tonight's
  // onchainAddress backfill).
  const turtleByReceipt = new Map<string, string>();
  try {
    for (const opp of await fetchTurtleOpportunities()) {
      const r = opp.receiptToken;
      if (!r?.address) continue;
      const chainId = resolveChainId(r.chain?.chainId, r.chain?.slug);
      if (chainId === null) continue;
      turtleByReceipt.set(`${r.address.toLowerCase()}:${chainId}`, opp.name);
    }
  } catch (e) {
    console.log(`(turtle feed unavailable: ${e instanceof Error ? e.message : e})`);
  }

  let total = 0;
  const pools = await fetchCentrifugePools();
  console.log(`Centrifuge: ${pools.length} pools\n`);

  // Wrapper instances mapped to parent symbol (mirrors the collector)
  const wrapperInstancesByParent = new Map<string, { address: string; chainId: number }[]>();
  for (const pool of pools) {
    if (!pool.name || !isWrapperPool(pool)) continue;
    const parentSymbol = pool.name.replace(/\s*deRWA\s*$/i, "").trim();
    const instances = pool.tokens.items.flatMap((t) =>
      t.tokenInstances.items
        .map((i) => ({ address: i.address.toLowerCase(), chainId: Number(i.blockchain?.id) }))
        .filter((i) => Number.isFinite(i.chainId) && i.chainId > 0)
    );
    wrapperInstancesByParent.set(parentSymbol, [
      ...(wrapperInstancesByParent.get(parentSymbol) ?? []),
      ...instances,
    ]);
  }

  for (const pool of pools) {
    if (!pool.isActive || !pool.name) continue;
    const wrapper = isWrapperPool(pool);
    for (const token of pool.tokens.items) {
      const tvl = poolTokenNavUsd(pool, token);
      if (tvl < MIN_TVL_USD) continue;
      if (wrapper) {
        console.log(`SKIP wrapper: ${pool.name} (${token.symbol}) — ${fmtUsd(tvl)} contained in parent fund`);
        continue;
      }
      const curator = prefixHit([pool.name, token.name]);
      if (!curator) {
        console.log(`SKIP unattributed: ${pool.name} (${token.symbol}) — ${fmtUsd(tvl)}`);
        continue;
      }
      total += tvl;

      const instances = [
        ...token.tokenInstances.items
          .map((i) => ({ address: i.address.toLowerCase(), chainId: Number(i.blockchain?.id) }))
          .filter((i) => Number.isFinite(i.chainId) && i.chainId > 0),
        ...(wrapperInstancesByParent.get(token.symbol) ?? []),
      ];
      const rows = await prisma.vault.findMany({
        where: {
          OR: [
            { onchainAddress: { in: instances.map((i) => i.address) } },
            { address: { in: instances.map((i) => i.address) } },
          ],
        },
        select: { name: true, address: true, chainId: true, onchainAddress: true, dataSource: true },
      });
      const matching = rows.filter((v) =>
        instances.some((i) => i.address === (v.onchainAddress ?? v.address).toLowerCase() && i.chainId === v.chainId)
      );
      console.log(`+ ${pool.name} (${token.symbol}) — ${fmtUsd(tvl)} — ${curator}`);
      for (const m of matching) {
        console.log(`    would ${m.dataSource === "turtle" ? "ADOPT/UNLINK" : "reuse"}: ${m.name} (${m.dataSource}, ${m.address.slice(0, 20)}…)`);
      }
      for (const i of instances) {
        const turtleOpp = turtleByReceipt.get(`${i.address}:${i.chainId}`);
        if (turtleOpp) console.log(`    turtle lists this instance: "${turtleOpp}" (chain ${i.chainId}) → adopted after backfill`);
      }
    }
  }

  for (const fund of ONCHAIN_FUNDS) {
    const { tvlUsd, totalSupply, decimals } = await readOnchainFundTvl(fund);
    total += tvlUsd;
    console.log(`+ ${fund.name} — ${fmtUsd(tvlUsd)} — ${fund.curatorName} (on-chain: supply ${totalSupply.toFixed(0)}, decimals ${decimals})`);
  }

  console.log(`\nTOTAL tokenized-funds segment: ${fmtUsd(total)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

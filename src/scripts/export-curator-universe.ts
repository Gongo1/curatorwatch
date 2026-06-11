/**
 * Export the site's Morpho vault universe + canonical curator identity for the risk
 * engine's V2 ingester. The engine (separate repo) ingests Morpho V2 history for
 * exactly these vaults and attributes them to *these* curator ids — so engine
 * ratings reconcile 1:1 with site curators (closes the V1/V2 identity gap).
 *
 * Output: a JSON array of { vault, chain, asset, curatorId, curatorName }.
 * curatorId is the site's canonical Curator.address (what CuratorRating joins on).
 *
 * Reusable: the Phase-2 weekly refresh re-runs this before each engine run.
 *
 *   npx tsx src/scripts/export-curator-universe.ts [outfile]
 */
import { writeFileSync } from "fs";
import { prisma } from "@/lib/db";
import { EXCLUDED_CURATORS } from "@/lib/curator-aliases";

async function main() {
  const out = process.argv[2] || "curator-universe.json";
  const rows = await prisma.vault.findMany({
    where: {
      dataSource: "morpho",
      address: { startsWith: "0x" },
      curator: { is: { name: { notIn: EXCLUDED_CURATORS } } },
    },
    select: {
      address: true,
      chainId: true,
      assetSymbol: true,
      curator: { select: { address: true, name: true } },
    },
  });

  const universe = rows
    .filter((r) => r.curator)
    .map((r) => ({
      vault: r.address,
      chain: r.chainId,
      asset: r.assetSymbol,
      curatorId: r.curator!.address.toLowerCase(),
      curatorName: r.curator!.name,
    }));

  const curators = new Set(universe.map((u) => u.curatorId)).size;
  writeFileSync(out, JSON.stringify(universe, null, 0));
  console.log(`Wrote ${universe.length} vaults / ${curators} curators -> ${out}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * READ-ONLY preview of what multi-chain Morpho ingestion would add.
 *
 * Fetches every configured chain (V1 + V2) through the exact fetch paths the
 * collector uses, diffs against vault rows already in the database, and prints
 * per-chain counts, TVL, and the largest incoming vaults/curators. Writes
 * nothing — safe to run against prod before deploying a chain-list change.
 *
 * Usage: npx tsx src/scripts/preview-morpho-multichain.ts
 */

import { prisma } from "../lib/db";
import {
  MORPHO_CHAINS,
  fetchAllVaults,
  fetchAllVaultsV1,
  fetchMorphoCuratorRegistry,
} from "./collect-data";
import { canonicalChainName } from "../lib/turtle/chain-mapper";

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

async function main() {
  const existing = await prisma.vault.findMany({
    select: { address: true },
  });
  const existingAddrs = new Set(existing.map((v) => v.address.toLowerCase()));
  console.log(`DB currently holds ${existing.length} vaults\n`);

  const registry = await fetchMorphoCuratorRegistry();

  let grandNew = 0;
  let grandNewTvl = 0;
  const newCurators = new Set<string>();

  for (const chain of MORPHO_CHAINS) {
    const chainName = canonicalChainName(chain.chainId);
    for (const isV1 of [false, true]) {
      const vaults = isV1
        ? await fetchAllVaultsV1(chain)
        : await fetchAllVaults(chain);
      const fresh = vaults.filter((v) => !existingAddrs.has(v.address.toLowerCase()));
      const freshTvl = fresh.reduce((s, v) => s + (v.totalAssetsUsd ?? 0), 0);
      grandNew += fresh.length;
      grandNewTvl += freshTvl;

      console.log(
        `${chainName} ${isV1 ? "V1" : "V2"}: ${vaults.length} vaults, ${fresh.length} new (${fmtUsd(freshTvl)} new TVL)`
      );
      for (const v of fresh
        .sort((a, b) => (b.totalAssetsUsd ?? 0) - (a.totalAssetsUsd ?? 0))
        .slice(0, 5)) {
        const canonical =
          v.curators?.items?.[0] ??
          (v.curator?.address ? registry.get(v.curator.address.toLowerCase()) : undefined);
        const org = canonical?.name ?? "unattributed";
        console.log(`    + ${v.name} — ${fmtUsd(v.totalAssetsUsd ?? 0)} — ${org}`);
        if (canonical) newCurators.add(org);
      }
    }
  }

  console.log(`\nTOTAL: ${grandNew} new vaults, ${fmtUsd(grandNewTvl)} new TVL`);
  console.log(`Curator orgs seen on new top vaults: ${[...newCurators].join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Import the risk-engine's versioned ratings JSON into the CuratorRating / VaultRating
 * read models. The engine (curatorwatch-risk-engine, Python/PyMC) runs OFFLINE — this
 * is the engine→Postgres bridge; the versioned JSON at data/risk-engine/ratings.json
 * is the contract.
 *
 * Curator join: the engine emits every curator address; we map each engine curator to
 * the matching site Curator by address intersection (the engine pulls the same Morpho
 * registry), else fall back to the engine's primary address so the row still imports.
 * Standalone tables → the import never blocks on identity resolution.
 *
 *   npx tsx src/scripts/import-risk-engine-ratings.ts [path/to/ratings.json]
 */
import { readFileSync } from "fs";
import { join } from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

interface EngineAddress { address: string; chainId: number }
interface EngineCurator {
  curator: string;
  name?: string;
  addresses: EngineAddress[];
  grade: string;
  el_median: number;
  el_ci90: [number, number];
  p_loss_annual_median: number | null;
  lgd_median: number | null;
  channels: Record<string, number>;
  confidence: string;
  flags: Record<string, boolean>;
  supporting: { n_vaults?: number; tvl_usd?: number; exposure_months?: number; events?: number };
}
interface EngineVault {
  vault: string; curator: string; grade: string;
  el_med: number; el_lo: number; el_hi: number;
  pd_ann_med?: number; lgd_med?: number;
}
interface RatingsFile {
  schema_version: string;
  methodology_version: string;
  model_git?: string;
  generated_at: string;
  curators: EngineCurator[];
  vaults: EngineVault[];
}

export async function importRiskEngineRatings(
  path = join(process.cwd(), "data", "risk-engine", "ratings.json"),
): Promise<{ curators: number; vaults: number; matched: number; unmatched: string[] }> {
  const data: RatingsFile = JSON.parse(readFileSync(path, "utf-8"));
  const generatedAt = new Date(data.generated_at);

  // site curator addresses for the join
  const siteCurators = await prisma.curator.findMany({ select: { address: true } });
  const siteAddrs = new Set(siteCurators.map((c) => c.address.toLowerCase()));

  let matched = 0;
  const unmatched: string[] = [];

  for (const c of data.curators) {
    const addrs = c.addresses.map((a) => a.address.toLowerCase());
    const hit = addrs.find((a) => siteAddrs.has(a));
    if (hit) matched++;
    else unmatched.push(c.curator);
    const curatorAddress = hit ?? addrs[0] ?? c.curator;

    const payload = {
      curatorKey: c.curator,
      name: c.name ?? null,
      grade: c.grade,
      elMedian: c.el_median,
      elCiLow: c.el_ci90[0],
      elCiHigh: c.el_ci90[1],
      pLossAnnual: c.p_loss_annual_median,
      lgdMedian: c.lgd_median,
      channels: c.channels as Prisma.InputJsonValue,
      confidence: c.confidence,
      flags: c.flags as Prisma.InputJsonValue,
      nVaults: c.supporting?.n_vaults ?? null,
      tvlUsd: c.supporting?.tvl_usd ?? null,
      exposureMonths: c.supporting?.exposure_months ?? null,
      events: c.supporting?.events ?? null,
      addresses: c.addresses as unknown as Prisma.InputJsonValue,
      methodologyVersion: data.methodology_version,
      schemaVersion: data.schema_version,
      modelGit: data.model_git ?? null,
      generatedAt,
    };
    await prisma.curatorRating.upsert({
      where: { curatorAddress },
      update: payload,
      create: { curatorAddress, ...payload },
    });
  }

  for (const v of data.vaults) {
    const [chainStr, vaultAddress] = v.vault.split(":");
    const payload = {
      chainId: Number(chainStr),
      vaultAddress: (vaultAddress ?? "").toLowerCase(),
      curatorKey: v.curator ?? null,
      grade: v.grade,
      elMedian: v.el_med,
      elCiLow: v.el_lo,
      elCiHigh: v.el_hi,
      pdAnnualMedian: v.pd_ann_med ?? null,
      lgdMedian: v.lgd_med ?? null,
      schemaVersion: data.schema_version,
      modelGit: data.model_git ?? null,
      generatedAt,
    };
    await prisma.vaultRating.upsert({
      where: { vaultKey: v.vault },
      update: payload,
      create: { vaultKey: v.vault, ...payload },
    });
  }

  return { curators: data.curators.length, vaults: data.vaults.length, matched, unmatched };
}

if (require.main === module) {
  const path = process.argv[2];
  importRiskEngineRatings(path)
    .then((r) => {
      console.log(`Imported ${r.curators} curator ratings (${r.matched} matched to site curators, ` +
        `${r.unmatched.length} unmatched: ${r.unmatched.join(", ") || "none"}), ${r.vaults} vault ratings.`);
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exitCode = 1;
    });
}

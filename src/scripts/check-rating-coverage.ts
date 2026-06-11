/**
 * READ-ONLY pre-launch check: how many engine ratings will actually surface on the
 * site? Reports curator address-join coverage (which curator pages show a grade) and
 * vault-key coverage (which vault pages / table rows show one). No writes.
 *
 *   npx tsx src/scripts/check-rating-coverage.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function main() {
  const data = JSON.parse(
    readFileSync(join(process.cwd(), "data", "risk-engine", "ratings.json"), "utf-8"),
  );

  const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const siteCurators = await prisma.curator.findMany({ select: { address: true, name: true } });
  const siteAddrs = new Set(siteCurators.map((c) => c.address.toLowerCase()));
  const siteNames = new Set(siteCurators.filter((c) => c.name).map((c) => norm(c.name)));
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const c of data.curators) {
    const aHit = c.addresses.map((a: any) => a.address.toLowerCase()).some((a: string) => siteAddrs.has(a));
    const nHit = siteNames.has(norm(c.name ?? c.curator));
    (aHit || nHit ? matched : unmatched).push(`${c.curator} (${c.grade})`);
  }

  const siteVaults = await prisma.vault.findMany({ select: { address: true, chainId: true } });
  const siteVaultKeys = new Set(siteVaults.map((v) => `${v.chainId}:${v.address.toLowerCase()}`));
  let vMatched = 0;
  for (const v of data.vaults) {
    const [c, a] = v.vault.split(":");
    if (siteVaultKeys.has(`${Number(c)}:${(a ?? "").toLowerCase()}`)) vMatched++;
  }

  console.log("=== EL rating coverage on the site ===");
  console.log(`curators: ${matched.length}/${data.curators.length} will show a grade (address + name match)`);
  console.log(`  matched:   ${matched.join(", ")}`);
  console.log(`  UNMATCHED: ${unmatched.join(", ") || "none"}`);
  console.log(`vaults:   ${vMatched}/${data.vaults.length} vault keys join to a site vault`);
  if (vMatched === 0) {
    console.log("  ⚠ vault grades are DORMANT: the engine (multi-chain, fresh Morpho pull) and the");
    console.log("    site (Ethereum-only, its own ingest) rate disjoint vault sets. Vault-level grades");
    console.log("    won't surface until the two ingest the SAME universe — curator grades are unaffected.");
  }
  console.log(`site totals: ${siteCurators.length} curators, ${siteVaults.length} vaults`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exitCode = 1; });

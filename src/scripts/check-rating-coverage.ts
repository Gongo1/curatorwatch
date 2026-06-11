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

  const siteCurators = await prisma.curator.findMany({ select: { address: true, name: true } });
  const siteAddrs = new Set(siteCurators.map((c) => c.address.toLowerCase()));
  const matched: string[] = [];
  const unmatched: string[] = [];
  for (const c of data.curators) {
    const hit = c.addresses.map((a: any) => a.address.toLowerCase()).find((a: string) => siteAddrs.has(a));
    (hit ? matched : unmatched).push(`${c.curator} (${c.grade})`);
  }

  const siteVaults = await prisma.vault.findMany({ select: { address: true, chainId: true } });
  const siteVaultKeys = new Set(siteVaults.map((v) => `${v.chainId}:${v.address.toLowerCase()}`));
  let vMatched = 0;
  for (const v of data.vaults) {
    const [c, a] = v.vault.split(":");
    if (siteVaultKeys.has(`${Number(c)}:${(a ?? "").toLowerCase()}`)) vMatched++;
  }

  console.log("=== EL rating coverage on the site ===");
  console.log(`curators: ${matched.length}/${data.curators.length} will show a grade`);
  console.log(`  matched:   ${matched.join(", ")}`);
  console.log(`  UNMATCHED: ${unmatched.join(", ") || "none"}`);
  console.log(`vaults:   ${vMatched}/${data.vaults.length} vault keys join to a site vault`);
  console.log(`site totals: ${siteCurators.length} curators, ${siteVaults.length} vaults`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exitCode = 1; });

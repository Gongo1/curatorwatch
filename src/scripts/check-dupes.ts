import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const curators = await prisma.curator.findMany({
    where: { name: { not: null } },
    select: { name: true, address: true, totalAssetsManaged: true },
  });

  const nameMap = new Map<string, typeof curators>();
  for (const c of curators) {
    const key = (c.name || "").toLowerCase().trim();
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key)!.push(c);
  }

  const dupes = Array.from(nameMap.entries()).filter(([_, v]) => v.length > 1);
  console.log(`Curators with multiple addresses (${dupes.length}):\n`);
  for (const [name, records] of dupes) {
    const totalAum = records.reduce((s, r) => s + (r.totalAssetsManaged || 0), 0);
    console.log(`  ${name}: ${records.length} addresses, combined AUM=$${totalAum.toFixed(0)}`);
    for (const r of records) {
      console.log(`    ${r.address} ($${(r.totalAssetsManaged || 0).toFixed(0)})`);
    }
  }

  await prisma.$disconnect();
}
main();

/**
 * Apply curator display-metadata overrides (src/lib/curator-overrides.ts) to the DB.
 *
 * - Overwrites name / website / twitter / description / entityType / jurisdiction /
 *   foundedYear when the override provides them (these are durable — the collectors
 *   only overwrite auto-generated names and never touch the other fields).
 * - Fills logoUrl only when the curator currently has none (preserves official logos).
 *
 * Run: npm run apply:curator-overrides
 */
import { prisma } from "../lib/db";
import { CURATOR_OVERRIDES } from "../lib/curator-overrides";

async function main() {
  let updated = 0;
  const missing: string[] = [];

  for (const [address, o] of Object.entries(CURATOR_OVERRIDES)) {
    const existing = await prisma.curator.findUnique({
      where: { address: address.toLowerCase() },
      select: { id: true, name: true, logoUrl: true },
    });
    if (!existing) {
      missing.push(address);
      continue;
    }

    await prisma.curator.update({
      where: { id: existing.id },
      data: {
        ...(o.name ? { name: o.name } : {}),
        ...(o.website ? { website: o.website } : {}),
        ...(o.twitter ? { twitter: o.twitter } : {}),
        ...(o.description ? { description: o.description } : {}),
        ...(o.entityType ? { entityType: o.entityType } : {}),
        ...(o.jurisdiction ? { jurisdiction: o.jurisdiction } : {}),
        ...(o.foundedYear ? { foundedYear: o.foundedYear } : {}),
        ...(o.logoUrl && !existing.logoUrl ? { logoUrl: o.logoUrl } : {}),
        updatedAt: new Date(),
      },
    });
    updated++;
  }

  console.log(`Applied ${updated} curator overrides.`);
  if (missing.length) console.log(`Not found in DB (${missing.length}): ${missing.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

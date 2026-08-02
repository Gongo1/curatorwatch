/**
 * Manually build + upsert today's Curator Daily digest (same logic as the
 * /api/cron/digest route). Useful for seeding/backfilling a digest off-cron.
 *
 *   npx tsx src/scripts/build-digest-once.ts
 */

import { prisma } from "../lib/db";
import { buildDigest } from "../lib/digest/build";
import { renderMarkdown, renderTitle, renderSummary } from "../lib/digest/render";
import { generateDigestProse } from "../lib/digest/generate";

async function main() {
  const now = new Date();
  const data = await buildDigest(now);

  let bodyMarkdown = renderMarkdown(data);
  let generatedBy = "template";
  const gen = await generateDigestProse(data).catch(() => null);
  if (gen) {
    bodyMarkdown = gen.bodyMarkdown;
    generatedBy = gen.generatedBy;
  }

  const title = renderTitle(data);
  const summary = renderSummary(data);

  const d = await prisma.digest.upsert({
    where: { slug: data.slug },
    create: {
      slug: data.slug,
      date: now,
      title,
      summary,
      bodyMarkdown,
      structuredJson: data as unknown as object,
      generatedBy,
      stressScore: data.stress.score,
      stressBand: data.stress.band,
      published: true,
    },
    update: {
      date: now,
      title,
      summary,
      bodyMarkdown,
      structuredJson: data as unknown as object,
      generatedBy,
      stressScore: data.stress.score,
      stressBand: data.stress.band,
    },
  });

  console.log(`[digest] ${d.slug} — stress ${data.stress.score} ${data.stress.band} (${generatedBy})`);
  console.log(`[digest] title: ${title}`);
  console.log(`[digest] summary: ${summary}`);
  console.log(
    `[digest] sections — inflows ${data.topInflows.length}, outflows ${data.topOutflows.length}, ` +
      `concentration ${data.concentration.length}, newVaults ${data.newVaults.length}, ` +
      `yieldMovers ${data.yieldMovers.length}, incidents ${data.incidents.count}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

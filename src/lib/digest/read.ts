/**
 * Read helpers for the stored Curator Daily digests. React-cache()-wrapped prisma
 * reads in the curator-detail.ts style — the /digest page and the /feed/digest.xml
 * RSS route both import from here so the query is shared and never duplicated.
 */

import { cache } from "react";
import { prisma } from "@/lib/db";

export const getLatestDigest = cache(async () =>
  prisma.digest.findFirst({ where: { published: true }, orderBy: { date: "desc" } })
);

export const getRecentDigests = cache(async (take = 30) =>
  prisma.digest.findMany({ where: { published: true }, orderBy: { date: "desc" }, take })
);

export const getDigestBySlug = cache(async (slug: string) =>
  prisma.digest.findUnique({ where: { slug } })
);

/** Last N daily stress readings (ascending) + the newest edition's drivers —
 *  feeds the homepage stress strip. Two slim queries: history rows skip the
 *  heavy structuredJson column, which is read for the latest row only. */
export const getStressHistory = cache(async (days = 8) => {
  const rows = await prisma.digest.findMany({
    where: { published: true, stressScore: { not: null } },
    orderBy: { date: "desc" },
    take: days,
    select: { slug: true, stressScore: true, stressBand: true },
  });
  if (rows.length === 0) return null;
  const latest = await prisma.digest.findFirst({
    where: { published: true, stressScore: { not: null } },
    orderBy: { date: "desc" },
    select: { structuredJson: true },
  });
  const drivers = (
    (latest?.structuredJson as { stress?: { drivers?: string[] } } | null)?.stress
      ?.drivers ?? []
  ).slice(0, 3);
  return {
    points: rows
      .reverse()
      .map((r) => ({
        slug: r.slug,
        score: r.stressScore as number,
        band: r.stressBand ?? "Calm",
      })),
    drivers,
  };
});

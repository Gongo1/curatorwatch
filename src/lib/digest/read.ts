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

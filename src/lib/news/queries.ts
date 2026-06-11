import { prisma } from "@/lib/db";
import { curatorSlug, EXCLUDED_CURATORS } from "@/lib/curator-aliases";

export interface RecentNewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO
  sentiment: string | null;
  category: string | null;
  curator: { name: string; slug: string } | null;
}

/**
 * Most-recent curator-tagged headlines across all tracked curators — the
 * global homepage newswire. Reads the precomputed CuratorNews table (populated
 * by the collect cron); never hits an external API at request time.
 */
export async function fetchRecentNews(limit = 12): Promise<RecentNewsItem[]> {
  const rows = await prisma.curatorNews.findMany({
    where: { curator: { name: { notIn: EXCLUDED_CURATORS } } },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      url: true,
      source: true,
      publishedAt: true,
      sentiment: true,
      category: true,
      curator: { select: { name: true, address: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    source: r.source,
    publishedAt: r.publishedAt.toISOString(),
    sentiment: r.sentiment,
    category: r.category,
    curator: r.curator?.name
      ? { name: r.curator.name, slug: curatorSlug(r.curator.name, r.curator.address) }
      : null,
  }));
}

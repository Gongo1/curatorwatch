import { getRecentDigests } from "@/lib/digest/read";

// Cached like the pages; the digest cron revalidates this path on each run.
export const revalidate = 21600;

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://curatorwatch.com";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const digests = await getRecentDigests(30);

  const items = digests
    .map((d) => {
      const link = `${SITE}/digest/${d.slug}`;
      const desc = [d.summary ?? "", "", d.bodyMarkdown].join("\n").trim();
      return [
        "    <item>",
        `      <title>${escapeXml(d.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${new Date(d.date).toUTCString()}</pubDate>`,
        `      <description>${escapeXml(desc)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>CuratorWatch — Curator Daily</title>",
    `    <link>${SITE}/digest</link>`,
    "    <description>Nightly digest of DeFi vault curator flows, concentration, yield moves, incidents, and the Curator Stress Index.</description>",
    "    <language>en-us</language>",
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}

/**
 * Newswire ingestion: pull free RSS feeds, keep only headlines that name a
 * curator we track, classify lightly, and upsert into CuratorNews.
 *
 * Runs as a step inside the 6h collect cron (and via /api/cron/fetch-news).
 * Precision over recall: we match on full, distinctive curator names/aliases
 * with word boundaries — a sparse, correct feed beats a noisy one.
 */
import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/db";
import { curatorSlug } from "@/lib/curator-aliases";
import {
  NEWS_FEEDS,
  MATCH_ALIASES,
  NAME_STOPLIST,
  COMMON_WORDS,
  MIN_SINGLE_TOKEN_LEN,
  type NewsFeed,
} from "./sources";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_AGE_DAYS = 120; // ignore items older than this on ingest
const MAX_CURATORS_PER_ITEM = 3; // >3 matches ⇒ likely a generic false positive
const BROWSER_UA =
  "Mozilla/5.0 (compatible; CuratorWatchBot/1.0; +https://curatorwatch.com)";

interface FeedItem {
  title: string;
  url: string;
  publishedAt: Date;
  description: string;
}

interface CuratorMatcher {
  id: string;
  name: string;
  address: string;
  re: RegExp;
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

// ── Feed fetching ──────────────────────────────────────────────────────────

async function fetchFeed(feed: NewsFeed): Promise<FeedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": BROWSER_UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    return parseFeed(body, feed.source);
  } finally {
    clearTimeout(timer);
  }
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Pull plain text out of a parsed node that may be a string, CDATA, or object. */
function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)["#text"] ?? "");
  }
  return String(node);
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFeed(body: string, source: string): FeedItem[] {
  const doc = xml.parse(body) as Record<string, unknown>;
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;

  // RSS 2.0: rss > channel > item[]   ·   Atom: feed > entry[]
  const channel = (doc.rss as Record<string, unknown>)?.["channel"] as Record<string, unknown> | undefined;
  const rssItems = asArray(channel?.["item"]);
  const atomEntries = asArray((doc.feed as Record<string, unknown>)?.["entry"]);

  const out: FeedItem[] = [];

  for (const it of rssItems as Record<string, unknown>[]) {
    const title = stripHtml(text(it.title));
    const url = text(it.link).trim();
    const dateStr = text(it.pubDate) || text(it["dc:date"]);
    const description = stripHtml(text(it.description)).slice(0, 400);
    pushItem(out, { title, url, dateStr, description }, cutoff, source);
  }

  for (const e of atomEntries as Record<string, unknown>[]) {
    const title = stripHtml(text(e.title));
    const linkNode = asArray(e.link)[0] as Record<string, unknown> | string | undefined;
    const url =
      typeof linkNode === "string" ? linkNode : String((linkNode as Record<string, unknown>)?.["@_href"] ?? "");
    const dateStr = text(e.updated) || text(e.published);
    const description = stripHtml(text(e.summary) || text(e.content)).slice(0, 400);
    pushItem(out, { title, url, dateStr, description }, cutoff, source);
  }

  return out;
}

function pushItem(
  out: FeedItem[],
  raw: { title: string; url: string; dateStr: string; description: string },
  cutoff: number,
  source: string
): void {
  if (!raw.title || !raw.url) return;
  const ts = new Date(raw.dateStr);
  const ms = ts.getTime();
  if (!Number.isFinite(ms)) return;
  if (ms < cutoff || ms > Date.now() + 86_400_000) return; // too old / future-dated
  void source;
  out.push({ title: raw.title, url: raw.url, publishedAt: ts, description: raw.description });
}

// ── Curator matchers ───────────────────────────────────────────────────────

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build the set of distinctive match phrases for one curator. */
function matchTerms(name: string, legalName: string | null): string[] {
  const terms = new Set<string>();

  const consider = (raw: string, vetted: boolean) => {
    const term = raw.trim();
    if (!term) return;
    const isPhrase = /\s/.test(term);
    if (vetted || isPhrase) {
      terms.add(term);
      return;
    }
    // single token: must be long enough and not a common word
    if (term.length >= MIN_SINGLE_TOKEN_LEN && !COMMON_WORDS.has(term.toLowerCase())) {
      terms.add(term);
    }
  };

  for (const a of MATCH_ALIASES[name] ?? []) consider(a, true);

  if (!NAME_STOPLIST.has(name)) {
    consider(name, false);
    if (legalName && legalName.toLowerCase() !== name.toLowerCase() && /\s/.test(legalName)) {
      // drop trailing entity suffixes so "Clearstar Labs AG" also matches "Clearstar Labs"
      consider(legalName.replace(/\s+(LLC|Ltd\.?|Inc\.?|AG|GmbH|LLP|L\.?P\.?)$/i, ""), false);
    }
  }

  return [...terms];
}

async function loadMatchers(): Promise<CuratorMatcher[]> {
  const curators = await prisma.curator.findMany({
    where: { name: { not: null } },
    select: { id: true, name: true, address: true, legalName: true },
  });

  const matchers: CuratorMatcher[] = [];
  for (const c of curators) {
    const terms = matchTerms(c.name!, c.legalName);
    if (terms.length === 0) continue;
    const re = new RegExp(`\\b(?:${terms.map(escapeRe).join("|")})\\b`, "i");
    matchers.push({ id: c.id, name: c.name!, address: c.address, re });
  }
  return matchers;
}

// ── Light classification ───────────────────────────────────────────────────

const RE_INCIDENT = /\b(hack|hacked|exploit|exploited|drain|depeg|de-peg|insolven|bad debt|attack|vulnerab|breach|stolen|rug|collapse|paused|frozen|shortfall|loss of funds)\b/i;
// Off-chain legal / regulatory / governance events — the kind the on-chain EL engine
// cannot price. A curator-matched headline hitting this is raised as a DISCLOSURE_CANDIDATE
// for human review (see disclosure-listener.ts).
const RE_LEGAL = /\b(lawsuit|sued|sues|suing|complaint|fraud|defraud|s\.?e\.?c\.?\b|securities and exchange|subpoena|indict|indicted|charged|prosecut|settlement|investigation|probe|litigation|sanction|enforcement action|injunction|class action|allege[sd]?|13\(?d\)?|wells notice|cease and desist)\b/i;
const RE_AUDIT = /\b(audit|attestation|proof of reserves|security review)\b/i;
const RE_PARTNER = /\b(partner|partnership|integrat|collaborat)\b/i;
const RE_POSITIVE = /\b(launch|launches|deploys?|goes live|mainnet|expand|raises?|funding|onboard|adds? support|new vault)\b/i;

function classify(title: string, description: string): { sentiment: string | null; category: string | null } {
  const t = `${title} ${description}`;
  // Legal/regulatory takes precedence over incident — it's the higher-signal, harder-to-price event.
  if (RE_LEGAL.test(t)) return { sentiment: "negative", category: "legal" };
  if (RE_INCIDENT.test(t)) return { sentiment: "negative", category: "incident" };
  if (RE_AUDIT.test(t)) return { sentiment: "positive", category: "audit" };
  if (RE_PARTNER.test(t)) return { sentiment: "positive", category: "partnership" };
  if (RE_POSITIVE.test(t)) return { sentiment: "positive", category: "announcement" };
  return { sentiment: null, category: null };
}

// ── Orchestration ──────────────────────────────────────────────────────────

export interface FetchNewsResult {
  feedsOk: number;
  feedsFailed: number;
  itemsScanned: number;
  matched: number;
  upserted: number;
  affectedSlugs: string[];
}

/** Fetch + match + classify with NO DB writes — for validating precision. */
export async function dryRunNews(): Promise<
  { curator: string; source: string; title: string; sentiment: string | null; category: string | null; url: string }[]
> {
  const matchers = await loadMatchers();
  const settled = await Promise.allSettled(NEWS_FEEDS.map((f) => fetchFeed(f).then((items) => ({ f, items }))));
  const items: { source: string; item: FeedItem }[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") for (const item of r.value.items) items.push({ source: r.value.f.source, item });
  }
  const seen = new Set<string>();
  const out: { curator: string; source: string; title: string; sentiment: string | null; category: string | null; url: string }[] = [];
  for (const { source, item } of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    const hits = matchers.filter((m) => m.re.test(`${item.title} ${item.description}`));
    if (hits.length === 0 || hits.length > MAX_CURATORS_PER_ITEM) continue;
    const { sentiment, category } = classify(item.title, item.description);
    for (const m of hits) out.push({ curator: m.name, source, title: item.title, sentiment, category, url: item.url });
  }
  return out;
}

export async function fetchNews(): Promise<FetchNewsResult> {
  const matchers = await loadMatchers();

  const settled = await Promise.allSettled(NEWS_FEEDS.map((f) => fetchFeed(f).then((items) => ({ f, items }))));
  let feedsOk = 0;
  let feedsFailed = 0;
  const items: { source: string; item: FeedItem }[] = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") {
      feedsOk++;
      for (const item of r.value.items) items.push({ source: r.value.f.source, item });
    } else {
      feedsFailed++;
      console.warn(`[news] feed failed: ${NEWS_FEEDS[i].source} — ${r.reason}`);
    }
  }

  // Dedupe identical URLs across feeds (keep first seen).
  const seen = new Set<string>();
  const unique = items.filter(({ item }) => (seen.has(item.url) ? false : (seen.add(item.url), true)));

  let matched = 0;
  let upserted = 0;
  const affected = new Set<string>();

  for (const { source, item } of unique) {
    const hay = `${item.title} ${item.description}`;
    const hits = matchers.filter((m) => m.re.test(hay));
    if (hits.length === 0 || hits.length > MAX_CURATORS_PER_ITEM) continue;
    matched++;

    const { sentiment, category } = classify(item.title, item.description);

    for (const m of hits) {
      try {
        // Dedupe in code (no DB unique needed): one row per (curator, url).
        const existing = await prisma.curatorNews.findFirst({
          where: { curatorId: m.id, url: item.url },
          select: { id: true },
        });
        if (existing) {
          await prisma.curatorNews.update({
            where: { id: existing.id },
            data: { title: item.title, source, publishedAt: item.publishedAt, sentiment, category },
          });
        } else {
          await prisma.curatorNews.create({
            data: {
              curatorId: m.id,
              title: item.title,
              summary: item.description || null,
              url: item.url,
              source,
              publishedAt: item.publishedAt,
              sentiment,
              category,
            },
          });
        }
        upserted++;
        affected.add(curatorSlug(m.name, m.address));
      } catch (e) {
        console.warn(`[news] upsert failed for ${m.name} / ${item.url}: ${e}`);
      }
    }
  }

  return {
    feedsOk,
    feedsFailed,
    itemsScanned: unique.length,
    matched,
    upserted,
    affectedSlugs: [...affected],
  };
}

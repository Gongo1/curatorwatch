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
  TOP_CURATOR_FEEDS,
  googleNewsSearchUrl,
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
  /** Google News items carry the real outlet in <source>; overrides feed label. */
  sourceOverride?: string;
}

interface CuratorMatcher {
  id: string;
  name: string;
  address: string;
  re: RegExp;
  /** Single-token names without a hand-vetted alias ("Felix", "Sierra") are
   *  homonym magnets — headlines must also carry crypto context to match. */
  requiresContext: boolean;
}

/** Crypto-context guard for ambiguous names. Deliberately excludes the bare
 *  word "vault" (pole vault, bank vault, campground vault toilet — all real
 *  false positives from the first Google News ingest). */
const RE_CRYPTO_CONTEXT =
  /\b(defi|crypto|cryptocurrency|stablecoin|onchain|on-chain|protocol|yield|lending|curator|morpho|hyperliquid|ethereum|solana|avalanche|tvl|token|multisig|perps?|blockchain|web3|usd[ct]|dao|treasur)/i;

/** Aggregator/price-tracker pages are listings, not news. */
const RE_JUNK_TITLE =
  /\b(price today|price prediction|live \S{0,20} ?price|market data|price chart|price analysis|to usd converter)\b/i;

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
    let title = stripHtml(text(it.title));
    const url = text(it.link).trim();
    const dateStr = text(it.pubDate) || text(it["dc:date"]);
    // Google News: <source> holds the real outlet, and titles come suffixed
    // with " - Outlet" — strip the duplicate suffix for clean display. Their
    // <description> is a related-articles boilerplate blob (poisons matching —
    // it almost always contains "crypto" somewhere — and is clutter as a
    // summary), so Google items carry no description: title-only matching.
    const sourceOverride = stripHtml(text(it.source)) || undefined;
    if (sourceOverride && title.endsWith(` - ${sourceOverride}`)) {
      title = title.slice(0, -(` - ${sourceOverride}`.length)).trim();
    }
    const description = sourceOverride ? "" : stripHtml(text(it.description)).slice(0, 400);
    pushItem(out, { title, url, dateStr, description, sourceOverride }, cutoff, source);
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
  raw: { title: string; url: string; dateStr: string; description: string; sourceOverride?: string },
  cutoff: number,
  source: string
): void {
  if (!raw.title || !raw.url) return;
  const ts = new Date(raw.dateStr);
  const ms = ts.getTime();
  if (!Number.isFinite(ms)) return;
  if (ms < cutoff || ms > Date.now() + 86_400_000) return; // too old / future-dated
  void source;
  out.push({
    title: raw.title,
    url: raw.url,
    publishedAt: ts,
    description: raw.description,
    sourceOverride: raw.sourceOverride,
  });
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
    const requiresContext =
      !MATCH_ALIASES[c.name!] && !/\s/.test(c.name!.trim());
    matchers.push({ id: c.id, name: c.name!, address: c.address, re, requiresContext });
  }
  return matchers;
}

/** Does this headline pass the matcher, including the ambiguity guard? */
function matcherHits(m: CuratorMatcher, hay: string): boolean {
  if (!m.re.test(hay)) return false;
  if (m.requiresContext && !RE_CRYPTO_CONTEXT.test(hay)) return false;
  return true;
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
  curatorFeedsOk: number;
  curatorFeedsFailed: number;
  itemsScanned: number;
  matched: number;
  upserted: number;
  affectedSlugs: string[];
}

/** In-memory dedupe + batched writes. The old per-item findFirst/update flow
 *  cost 2-3 pooler round-trips per matched item (~700/run) and blew the
 *  serverless budget from Vercel; one read + one createMany replaces it.
 *  First write wins — rows are immutable once ingested. */
class NewsCollector {
  private known = new Set<string>();
  private creates: {
    curatorId: string;
    title: string;
    summary: string | null;
    url: string;
    source: string;
    publishedAt: Date;
    sentiment: string | null;
    category: string | null;
  }[] = [];

  static async load(): Promise<NewsCollector> {
    const c = new NewsCollector();
    const rows = await prisma.curatorNews.findMany({
      select: { curatorId: true, url: true, title: true },
    });
    for (const r of rows) {
      c.known.add(`${r.curatorId} u:${r.url}`);
      c.known.add(`${r.curatorId} t:${r.title}`);
    }
    return c;
  }

  /** Returns true when the item is new for this curator (queued for insert). */
  add(m: CuratorMatcher, item: FeedItem, source: string): boolean {
    const kUrl = `${m.id} u:${item.url}`;
    const kTitle = `${m.id} t:${item.title}`;
    if (this.known.has(kUrl) || this.known.has(kTitle)) return false;
    this.known.add(kUrl);
    this.known.add(kTitle);
    const { sentiment, category } = classify(item.title, item.description);
    this.creates.push({
      curatorId: m.id,
      title: item.title,
      summary: item.description || null,
      url: item.url,
      source,
      publishedAt: item.publishedAt,
      sentiment,
      category,
    });
    return true;
  }

  async flush(): Promise<number> {
    let written = 0;
    for (let i = 0; i < this.creates.length; i += 200) {
      const chunk = this.creates.slice(i, i + 200);
      try {
        const r = await prisma.curatorNews.createMany({ data: chunk });
        written += r.count;
      } catch (e) {
        console.warn(`[news] createMany chunk failed (${chunk.length} rows): ${e}`);
      }
    }
    return written;
  }
}

/** Top curators (by AUM) that have a distinctive query phrase — the Google News
 *  per-curator targets. Phrase preference: hand-vetted alias, else the name
 *  when it isn't stoplisted. */
async function loadCuratorFeedTargets(
  matchers: CuratorMatcher[]
): Promise<{ matcher: CuratorMatcher; phrase: string }[]> {
  const byId = new Map(matchers.map((m) => [m.id, m]));
  const top = await prisma.curator.findMany({
    where: { name: { not: null }, totalAssetsManaged: { gt: 0 } },
    orderBy: { totalAssetsManaged: "desc" },
    take: TOP_CURATOR_FEEDS,
    select: { id: true, name: true },
  });
  const targets: { matcher: CuratorMatcher; phrase: string }[] = [];
  for (const c of top) {
    const matcher = byId.get(c.id);
    if (!matcher || !c.name) continue;
    const phrase = MATCH_ALIASES[c.name]?.[0] ?? (NAME_STOPLIST.has(c.name) ? null : c.name);
    if (!phrase || phrase.length < 4) continue;
    targets.push({ matcher, phrase });
  }
  return targets;
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
    if (RE_JUNK_TITLE.test(item.title)) continue;
    const hits = matchers.filter((m) => matcherHits(m, `${item.title} ${item.description}`));
    if (hits.length === 0 || hits.length > MAX_CURATORS_PER_ITEM) continue;
    const { sentiment, category } = classify(item.title, item.description);
    for (const m of hits) out.push({ curator: m.name, source, title: item.title, sentiment, category, url: item.url });
  }
  return out;
}

export async function fetchNews(): Promise<FetchNewsResult> {
  const matchers = await loadMatchers();
  const collector = await NewsCollector.load();

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
  const affected = new Set<string>();

  for (const { source, item } of unique) {
    if (RE_JUNK_TITLE.test(item.title)) continue;
    const hay = `${item.title} ${item.description}`;
    const hits = matchers.filter((m) => matcherHits(m, hay));
    if (hits.length === 0 || hits.length > MAX_CURATORS_PER_ITEM) continue;
    matched++;

    for (const m of hits) {
      if (collector.add(m, item, item.sourceOverride ?? source)) {
        affected.add(curatorSlug(m.name, m.address));
      }
    }
  }

  // ── Phase B: per-curator Google News query feeds (the recall layer) ──
  // Items are pre-scoped by the query, but each headline must still pass the
  // curator's own matcher regex — Google fuzzy-matches queries, and precision
  // beats recall here.
  const targets = await loadCuratorFeedTargets(matchers);
  let curatorFeedsOk = 0;
  let curatorFeedsFailed = 0;
  const BATCH = 10;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const settled2 = await Promise.allSettled(
      batch.map((t) =>
        fetchFeed({ source: "Google News", url: googleNewsSearchUrl(t.phrase) }).then(
          (items) => ({ t, items })
        )
      )
    );
    for (let j = 0; j < settled2.length; j++) {
      const r = settled2[j];
      if (r.status !== "fulfilled") {
        curatorFeedsFailed++;
        console.warn(`[news] curator feed failed: ${batch[j].matcher.name} — ${r.reason}`);
        continue;
      }
      curatorFeedsOk++;
      const { t, items: feedItems } = r.value;
      for (const item of feedItems) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        if (RE_JUNK_TITLE.test(item.title)) continue;
        if (!matcherHits(t.matcher, `${item.title} ${item.description}`)) continue;
        matched++;
        if (collector.add(t.matcher, item, item.sourceOverride ?? "Google News")) {
          affected.add(curatorSlug(t.matcher.name, t.matcher.address));
        }
      }
    }
  }

  const upserted = await collector.flush();

  return {
    feedsOk,
    feedsFailed,
    curatorFeedsOk,
    curatorFeedsFailed,
    itemsScanned: unique.length,
    matched,
    upserted,
    affectedSlugs: [...affected],
  };
}

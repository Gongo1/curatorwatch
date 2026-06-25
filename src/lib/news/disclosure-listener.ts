/**
 * Disclosure listener — surfaces possible off-chain legal / regulatory / governance
 * events about tracked curators as DISCLOSURE_CANDIDATE platform alerts for HUMAN review.
 *
 * Two sources:
 *   Tier 1 (newswire): CuratorNews rows the classifier tagged `category: "legal"`.
 *   Tier 2 (SEC EDGAR): full-text search (efts.sec.gov) for each curator's name across
 *           recently-filed documents — this is what catches a curator being named in a
 *           public company's 8-K (e.g. RockawayX in the Forward Industries 8-K / SEC 13(d)).
 *
 * These are CANDIDATES, never auto-published. A human reviews the alert and, if material,
 * runs the `curator-disclosure` skill to publish a sourced disclosure on the product.
 * Deduped by source URL so the same filing/headline never re-alerts.
 */

import { prisma } from "../db";
import type { PlatformAlertEvent } from "../curator-alert-detector";
import { ALERT_TYPES } from "../change-thresholds";
import { EXCLUDED_CURATORS } from "../curator-aliases";

const SEC_UA = "CuratorWatch newswire (austingongora13@gmail.com)";
const EDGAR_LOOKBACK_DAYS = 7;
const NEWS_LOOKBACK_DAYS = 3;
const SEC_DELAY_MS = 120; // polite spacing, well under SEC's 10 req/s
// Require adversarial legal language alongside the curator name. This cuts a public-filer
// curator's routine filings way down ("Galaxy Digital" alone returns ~700 filings/month; with
// this clause, ~30) while still catching the RockawayX-style 8-K. EFTS quirks (verified against
// the live API): parentheses and `OR` must be LITERAL in the URL (encoded "%28"/"%29" 500s),
// and nested quoted phrases (e.g. "13(d)", "wells notice") return 0 — so only single, rarely-
// boilerplate tokens are used here.
const EDGAR_LEGAL_CLAUSE =
  "(lawsuit OR sued OR suing OR fraud OR defraud OR complaint OR subpoena OR indictment OR indicted)";

/** EFTS rejects percent-encoded parens, so restore them after encoding the rest. */
function encodeEftsQuery(q: string): string {
  return encodeURIComponent(q).replace(/%28/g, "(").replace(/%29/g, ")");
}

// Off-chain legal/governance events surface in event & control filings. Annual/registration
// boilerplate (11-K benefit plans, 10-K/20-F risk factors, S-1) mention asset managers like
// "Galaxy Digital" / "Janus Henderson" alongside legal words and are pure noise — drop them.
const EDGAR_RELEVANT_FORMS = new Set([
  "8-K", "8-K/A", "6-K", "6-K/A", "SC 13D", "SC 13D/A", "DEF 14A", "DEFA14A", "425",
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Source URLs already raised as candidates — for dedup across runs. */
async function existingCandidateUrls(): Promise<Set<string>> {
  const rows = await prisma.platformAlert.findMany({
    where: { changeType: ALERT_TYPES.DISCLOSURE_CANDIDATE },
    select: { metadata: true },
  });
  const s = new Set<string>();
  for (const r of rows) {
    const u = (r.metadata as { url?: unknown } | null)?.url;
    if (typeof u === "string") s.add(u);
  }
  return s;
}

/** Tier 1 — legal-tagged newswire headlines → candidates. */
async function legalNewsCandidates(seen: Set<string>, now: Date): Promise<PlatformAlertEvent[]> {
  const since = new Date(now.getTime() - NEWS_LOOKBACK_DAYS * 86_400_000);
  const rows = await prisma.curatorNews.findMany({
    where: { category: "legal", publishedAt: { gte: since } },
    select: {
      url: true, title: true, source: true,
      curator: { select: { id: true, name: true } },
    },
    orderBy: { publishedAt: "desc" },
  });

  const out: PlatformAlertEvent[] = [];
  for (const r of rows) {
    if (!r.curator || seen.has(r.url)) continue;
    seen.add(r.url);
    out.push({
      scope: "curator",
      curatorId: r.curator.id,
      changeType: ALERT_TYPES.DISCLOSURE_CANDIDATE,
      severity: "critical",
      title: `Possible disclosure event: ${r.curator.name ?? "curator"}`,
      description: `${r.source}: “${r.title}”. Legal/regulatory headline matched — review and, if material, run the curator-disclosure skill.`,
      detectedAt: now,
      metadata: { url: r.url, source: r.source, origin: "newswire" },
    });
  }
  return out;
}

// Single-word curator names that are common English words ("Status", "Spark", "Idle",
// "Gauntlet"…) match the same word inside thousands of unrelated filings, so we DON'T
// auto-query them. Only multi-word names (queried as exact phrases — specific by nature)
// and a small allowlist of distinctive single-word names are EDGAR-watched. Extend the
// allowlist as you find curators with a real US-filing footprint.
const EDGAR_SINGLE_WORD_WATCH = new Set<string>(["rockawayx"]);

/** Pick a search term specific enough to not match unrelated filings (or null to skip). */
function edgarTerm(name: string | null, legalName: string | null): string | null {
  // Prefer a multi-word name/legal name — an exact-phrase match won't hit a lone common word.
  for (const c of [legalName, name]) {
    if (c && /\s/.test(c.trim())) return c.trim();
  }
  // Single-word name: only if explicitly allowlisted (distinctive proper noun).
  const n = name?.trim();
  if (n && !/\s/.test(n) && EDGAR_SINGLE_WORD_WATCH.has(n.toLowerCase())) return n;
  return null;
}

/** Build the canonical filing URL from an EFTS hit `_id` ("<accession>:<file>") + ciks. */
function filingUrl(id: string | undefined, ciks: string[] | undefined): string | null {
  if (!id || !ciks?.length) return null;
  const [acc, file] = id.split(":");
  if (!acc || !file) return null;
  const cik = String(parseInt(ciks[0], 10)); // strip leading zeros
  if (!Number.isFinite(Number(cik))) return null;
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, "")}/${file}`;
}

/** Tier 2 — SEC EDGAR full-text search for recent filings naming each curator. */
async function edgarCandidates(seen: Set<string>, now: Date): Promise<PlatformAlertEvent[]> {
  const startdt = ymd(new Date(now.getTime() - EDGAR_LOOKBACK_DAYS * 86_400_000));
  const enddt = ymd(now);
  const curators = await prisma.curator.findMany({
    where: {
      vaultCount: { gt: 0 },
      ...(EXCLUDED_CURATORS.length ? { NOT: { name: { in: EXCLUDED_CURATORS } } } : {}),
    },
    select: { id: true, name: true, legalName: true },
  });

  const out: PlatformAlertEvent[] = [];
  for (const c of curators) {
    const term = edgarTerm(c.name, c.legalName);
    if (!term) continue;
    const url =
      `https://efts.sec.gov/LATEST/search-index?q=${encodeEftsQuery(`"${term}" ${EDGAR_LEGAL_CLAUSE}`)}` +
      `&startdt=${startdt}&enddt=${enddt}`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": SEC_UA, Accept: "application/json" } });
      if (res.ok) {
        const data = (await res.json()) as {
          hits?: { hits?: Array<{ _id?: string; _source?: Record<string, unknown> }> };
        };
        for (const h of data?.hits?.hits ?? []) {
          const src = h._source ?? {};
          const fu = filingUrl(h._id, src.ciks as string[] | undefined);
          if (!fu || seen.has(fu)) continue;
          const form = (src.root_forms as string[] | undefined)?.[0] ?? (src.form_type as string) ?? "filing";
          if (!EDGAR_RELEVANT_FORMS.has(form)) continue; // skip boilerplate forms (11-K, 10-K, 20-F, S-1…)
          seen.add(fu);
          const filer = (src.display_names as string[] | undefined)?.[0] ?? "an SEC filer";
          const fileDate = (src.file_date as string) ?? enddt;
          out.push({
            scope: "curator",
            curatorId: c.id,
            changeType: ALERT_TYPES.DISCLOSURE_CANDIDATE,
            severity: "critical",
            title: `Possible disclosure event: ${c.name ?? term}`,
            description: `Named in a ${form} SEC filing by ${filer} (${fileDate}). Review and, if material, run the curator-disclosure skill.`,
            detectedAt: now,
            metadata: { url: fu, source: "SEC EDGAR", origin: "edgar", form, filer, query: term, fileDate },
          });
        }
      }
    } catch {
      // one curator's query failing must not kill the scan
    }
    await sleep(SEC_DELAY_MS);
  }
  return out;
}

/** All disclosure candidates this run (newswire + EDGAR), deduped by source URL. */
export async function detectDisclosureCandidates(): Promise<PlatformAlertEvent[]> {
  const now = new Date();
  const seen = await existingCandidateUrls();
  const news = await legalNewsCandidates(seen, now);
  const edgar = await edgarCandidates(seen, now);
  return [...news, ...edgar];
}

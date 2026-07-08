/**
 * Newswire sources + curator-matching configuration.
 *
 * We aggregate free, public RSS feeds from crypto/DeFi publications, then keep
 * only the headlines that name a curator we track. Feeds are read and linked
 * back to the source (never republished); outlets publish these feeds for
 * exactly this kind of syndication. No API keys, no quotas, no cost.
 */

export interface NewsFeed {
  /** Display label stored as CuratorNews.source (e.g. "CoinDesk"). */
  source: string;
  url: string;
}

/**
 * DeFi-heavy outlets most likely to actually name curators. The pipeline
 * tolerates a dead feed (DL News shut down May 2026) — a fetch failure on one
 * source never aborts the run.
 */
export const NEWS_FEEDS: NewsFeed[] = [
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss" },
  { source: "The Defiant", url: "https://thedefiant.io/api/feed" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss/tag/defi" },
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "Blockworks", url: "https://blockworks.com/feed" },
  { source: "The Block", url: "https://www.theblock.co/rss.xml" },
  { source: "CryptoSlate", url: "https://cryptoslate.com/feed/" },
];

/**
 * Extra safe match phrases per curator (keyed by the curator's `name`).
 * These are hand-vetted, so they bypass the generic-term guards below — use
 * them for short forms a headline would actually use ("Re7", not just
 * "Re7 Labs"). Keep phrases distinctive; never add a bare common word here.
 */
export const MATCH_ALIASES: Record<string, string[]> = {
  "Re7 Labs": ["Re7", "Re7 Capital"],
  Gauntlet: ["Gauntlet"],
  "MEV Capital": ["MEV Capital"], // never bare "MEV" (maximal extractable value)
  "Steakhouse Financial": ["Steakhouse Financial"], // never bare "Steakhouse"
  "Spark Protocol": ["Spark Protocol"], // never bare "Spark"
  "Idle Finance": ["Idle Finance"], // never bare "Idle"
  Sentora: ["Sentora", "IntoTheBlock"], // rebrand of IntoTheBlock
  "Block Analitica": ["Block Analitica", "BlockAnalitica"],
  "August Digital": ["August Digital"], // never bare "August"
};

/**
 * Curator names whose bare name is too generic to auto-match from a headline.
 * A curator on this list only matches via its MATCH_ALIASES entry or a
 * multi-word legal name — never on the lone `name`.
 */
export const NAME_STOPLIST = new Set<string>([
  "Mainstreet",
  "gtsy",
  "AlphaPing",
  "Morpho", // the protocol/org, not a third-party curator — appears in ~every headline
  "Morpho Association",
]);

/**
 * Single, common English/finance words that must never be a match term on
 * their own. A single-token curator name (or alias) is rejected if it lands
 * here, so "Spark"/"Idle"/"August" can't tag unrelated stories. Multi-word
 * phrases ("MEV Capital") are exempt — the phrase itself is distinctive.
 */
export const COMMON_WORDS = new Set<string>([
  "capital", "labs", "finance", "protocol", "digital", "association",
  "morpho", "ethereum", "vault", "vaults", "defi", "yield", "spark",
  "idle", "august", "block", "core", "prime", "summit", "summits",
  "mev", "steakhouse", "re", "main", "mainstreet", "ping", "alpha",
]);

/** Minimum length for a single-token term to be eligible at all. */
export const MIN_SINGLE_TOKEN_LEN = 5;

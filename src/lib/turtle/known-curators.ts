/**
 * Allowlist of confirmed Turtle-sourced CURATORS.
 *
 * Turtle surfaces many entities that are NOT curators (protocols, stablecoin
 * issuers, chains, Curve pools, the Turtle distributor itself). The old collector
 * minted a synthetic `turtle-<slug>` curator for every one of them, inflating the
 * curator directory by ~$556M of non-curators.
 *
 * This is the small, human-reviewed identity/override layer (presentation only):
 * entities here have been verified as genuine third-party vault curators that just
 * don't appear in the Morpho-sourced curator set. Matched Turtle opportunities are
 * attributed to a clean curator row addressed `tc:<slug>` (NOT `turtle-`, so it is
 * not filtered out of the directory). Everything not on this list stays unattributed
 * (hidden) and is surfaced by `npm run report:unmatched-turtle` for review.
 *
 * Verified via web research, 2026-05 (see triage). Qualia was intentionally held
 * back (medium confidence) pending more verification — do not add without review.
 */

export interface KnownTurtleCurator {
  /** Stable slug → curator address `tc:<slug>`. */
  slug: string;
  /** Canonical display name. */
  name: string;
  /** Curator website, if known. */
  website?: string;
  /**
   * Lowercased names this curator is known by in Turtle data (opp.curator.name or
   * a name extracted from the vault title). Matching is normalized + substring-aware.
   */
  aliases: string[];
}

export const KNOWN_TURTLE_CURATORS: KnownTurtleCurator[] = [
  {
    slug: "telosc",
    name: "TelosC",
    website: "https://telosc.com/",
    aliases: ["telosc", "telosc earn", "telos consilium", "telos"],
  },
  {
    slug: "k3-capital",
    name: "K3 Capital",
    website: "https://k3-capital.net/",
    aliases: ["k3 capital", "k3"],
  },
  {
    slug: "axil",
    name: "Axil",
    website: "https://www.axil.pro/",
    aliases: ["axil"],
  },
  {
    slug: "perseus-digital",
    name: "Perseus Digital",
    aliases: ["perseus digital", "perseus"],
  },
  {
    slug: "clearstar",
    name: "Clearstar Labs",
    aliases: ["clearstar", "clearstar labs", "clearstar earn"],
  },
  {
    slug: "9summits",
    name: "9Summits",
    website: "https://9summits.io/",
    aliases: ["9summits", "9 summits"],
  },
  {
    slug: "farm-capital",
    name: "Farm Capital",
    website: "https://www.farmcapital.xyz/",
    aliases: ["farm capital"],
  },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Resolve a Turtle-provided name to an allowlisted curator, or null.
 * Matches on normalized equality or substring (either direction) against aliases,
 * which is safe because the aliases are specific enough not to collide with the
 * (verified) non-curator names.
 */
export function resolveKnownCurator(name: string | null | undefined): KnownTurtleCurator | null {
  if (!name) return null;
  const n = normalize(name);
  if (!n) return null;
  for (const c of KNOWN_TURTLE_CURATORS) {
    for (const alias of c.aliases) {
      if (n === alias || n.includes(alias) || alias.includes(n)) return c;
    }
  }
  return null;
}

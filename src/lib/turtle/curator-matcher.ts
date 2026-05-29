/**
 * Matches Turtle opportunities to EXISTING DB curators by name.
 *
 * Turtle's API gives a curator *name* only (no on-chain address — see TurtleCurator),
 * so matching is name-based and best-effort. We NEVER fabricate a curator: a curator
 * is an entity that manages vaults, and Turtle is a distributor/data source, not a
 * curator. If we can't confidently match a Turtle opportunity to a real curator, we
 * return null and the caller leaves the vault unattributed (hidden from the directory)
 * and reports it — rather than minting a synthetic "turtle-<slug>" curator that would
 * pollute the curator directory and inflate curator TVL.
 */

import { prisma } from "@/lib/db";
import { extractCuratorFromVaultName } from "@/lib/utils/extract-curator-name";
import { resolveKnownCurator } from "./known-curators";
import type { TurtleCurator } from "./types";

/**
 * Manual map: Turtle API name (lowercase) → canonical DB curator name.
 * This is the tiny, presentation/identity override layer — extend it to rescue
 * known curators that don't auto-match. It never creates curators; it only helps
 * resolve a Turtle name to one that already exists in the DB.
 */
const CURATOR_NAME_ALIASES: Record<string, string> = {
  "steakhouse": "Steakhouse Financial",
  "yearn": "Yearn Finance",
  "re7 labs": "Re7 Labs",
  "re7": "Re7 Labs",
  "re7 capital": "Re7 Labs",
  "gauntlet": "Gauntlet",
  "hyperithm": "Hyperithm",
  "mev capital": "MEV Capital",
  "block analitica": "Block Analitica",
  "idle": "Idle Finance",
  "idle finance": "Idle Finance",
  "morpho association": "Morpho",
  "instadapp": "Instadapp",
  "avant": "Avantgarde Finance",
  "avantgarde": "Avantgarde Finance",
  "susdf": "Falcon Finance",
};

/** Common entity suffixes/qualifiers stripped during normalized matching. */
const NORMALIZE_STOPWORDS = new Set([
  "finance", "financial", "labs", "lab", "capital", "dao", "association",
  "protocol", "ag", "llc", "ltd", "inc", "foundation", "ventures", "xyz",
]);

/** Normalize a name for fuzzy equality: lowercase, drop stopwords + non-alphanumerics. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !NORMALIZE_STOPWORDS.has(w))
    .join("");
}

interface CuratorRef {
  id: string;
  name: string | null;
  exact: string; // lowercased name
  norm: string; // normalized name
}

/**
 * Lazily cached list of real curators (id + name), used for in-memory matching.
 * Synthetic `turtle-*` curators are excluded so we never match to a leftover one.
 * Safe to cache within a single collection run: this module no longer creates
 * curators, so the set is stable for the duration of the process.
 */
let curatorCache: CuratorRef[] | null = null;

async function getCurators(): Promise<CuratorRef[]> {
  if (curatorCache) return curatorCache;
  const rows = await prisma.curator.findMany({
    where: { address: { not: { startsWith: "turtle-" } } },
    select: { id: true, name: true },
  });
  curatorCache = rows
    .filter((r) => r.name && r.name.trim())
    .map((r) => ({
      id: r.id,
      name: r.name,
      exact: r.name!.toLowerCase().trim(),
      norm: normalizeName(r.name!),
    }));
  return curatorCache;
}

/** Reset the in-memory curator cache (call between runs / in tests). */
export function resetCuratorCache(): void {
  curatorCache = null;
}

function findMatch(curators: CuratorRef[], candidate: string): string | null {
  const lower = candidate.toLowerCase().trim();
  if (!lower) return null;

  // 1. Exact (case-insensitive) name match
  const exact = curators.find((c) => c.exact === lower);
  if (exact) return exact.id;

  // 2. Normalized match (suffix/punctuation-insensitive)
  const norm = normalizeName(candidate);
  if (norm.length >= 3) {
    const fuzzy = curators.find((c) => c.norm === norm);
    if (fuzzy) return fuzzy.id;
  }

  return null;
}

/**
 * Best-effort match of a Turtle opportunity to an existing curator.
 * Returns the matched curator id, or null if no confident match exists.
 *
 * @param opportunityName The Turtle opportunity (vault) name.
 * @param curatorData The Turtle API curator object (name only), if present.
 */
export async function matchCurator(
  opportunityName: string,
  curatorData?: TurtleCurator
): Promise<string | null> {
  const curators = await getCurators();

  // Candidate names, in priority order: API curator name first, then a name
  // extracted from the vault title as a weaker fallback.
  const rawCandidates = [
    curatorData?.name,
    extractCuratorFromVaultName(opportunityName),
  ].filter((n): n is string => Boolean(n && n.trim()));

  for (const raw of rawCandidates) {
    const aliased = CURATOR_NAME_ALIASES[raw.toLowerCase().trim()];
    // Try alias-resolved canonical name first, then the raw name.
    const match =
      (aliased && findMatch(curators, aliased)) || findMatch(curators, raw);
    if (match) return match;
  }

  // 2. Allowlisted Turtle-only curators (verified, human-reviewed). These don't
  // exist in the Morpho-sourced set, so attribute them to a clean `tc:<slug>`
  // curator row, upserting it on first sight. Gated entirely by the allowlist —
  // this is the only path that creates a curator, and only for reviewed entities.
  for (const raw of rawCandidates) {
    const known = resolveKnownCurator(raw);
    if (known) {
      const c = await prisma.curator.upsert({
        where: { address: `tc:${known.slug}` },
        update: {},
        create: {
          address: `tc:${known.slug}`,
          name: known.name,
          website: known.website || undefined,
        },
      });
      return c.id;
    }
  }

  return null;
}

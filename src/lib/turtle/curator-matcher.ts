/**
 * Resolves a Turtle opportunity to a curator — matching an existing one, or creating
 * one from the Turtle-provided curator name.
 *
 * Turtle's API gives a curator *name* only (no on-chain address — see TurtleCurator),
 * so this is name-based. Resolution order: (1) match an existing DB curator by name /
 * alias; (2) an allowlisted Turtle-only curator with a curated name + website; (3) the
 * source-derived path — auto-create a clean `tc:<slug>` curator from the API curator
 * name, UNLESS it is a denylisted protocol/infra entity (Aave, Euler, …) or has no
 * name, in which case we return null and the caller skips the opportunity. We never
 * create from a name guessed off the vault title (that caused generic-name pollution).
 */

import { prisma } from "@/lib/db";
import { extractCuratorFromVaultName } from "@/lib/utils/extract-curator-name";
import { resolveKnownCurator, isProtocolDenylisted } from "./known-curators";
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
  "clearstar": "Clearstar Labs AG",
  "clearstar labs": "Clearstar Labs AG",
  "clearstar earn": "Clearstar Labs AG",
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

/** URL/address-safe slug from a curator name, for the `tc:<slug>` address. */
function slugifyCurator(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
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
 * What matchCurator() resolves a name pair to, decided without writing:
 * an existing curator id, a clean `tc:<slug>` curator to upsert, or null.
 */
type CuratorPlan =
  | { kind: "existing"; id: string }
  | { kind: "tc"; address: string; name: string; website?: string }
  | null;

async function planCuratorMatch(
  opportunityName: string,
  curatorData?: TurtleCurator
): Promise<CuratorPlan> {
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
    if (match) return { kind: "existing", id: match };
  }

  // 2. Allowlisted Turtle-only curators (verified, human-reviewed). Attributed to a
  // clean `tc:<slug>` row with a curated display name + website, upserted on first
  // sight. Checked before step 3 so these keep their nicer canonical name/website.
  for (const raw of rawCandidates) {
    const known = resolveKnownCurator(raw);
    if (known) {
      return {
        kind: "tc",
        address: `tc:${known.slug}`,
        name: known.name,
        website: known.website || undefined,
      };
    }
  }

  // 3. Source-derived identity: auto-create a curator from the Turtle-provided curator
  // name. Create a clean `tc:<slug>` row for any opportunity whose curator isn't already
  // in the DB, isn't allowlisted, and isn't a denylisted protocol/infra entity. Only the
  // explicit API curator field is trusted — never a name guessed off the vault title —
  // so this doesn't resurrect the generic-name pollution of the old synthetic collector.
  const turtleName = curatorData?.name?.trim();
  if (turtleName && turtleName.length >= 2 && !isProtocolDenylisted(turtleName)) {
    const slug = slugifyCurator(turtleName);
    if (slug) return { kind: "tc", address: `tc:${slug}`, name: turtleName };
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
  const plan = await planCuratorMatch(opportunityName, curatorData);
  if (plan === null) return null;
  if (plan.kind === "existing") return plan.id;

  const c = await prisma.curator.upsert({
    where: { address: plan.address },
    update: {},
    create: {
      address: plan.address,
      name: plan.name,
      website: plan.website,
      logoUrl: curatorData?.iconUrl || undefined,
    },
  });
  // Persist the Turtle-provided icon for rows that predate logo capture —
  // fill-if-missing only, never clobber an existing logo.
  if (!c.logoUrl && curatorData?.iconUrl) {
    await prisma.curator.update({
      where: { id: c.id },
      data: { logoUrl: curatorData.iconUrl },
    });
  }
  return c.id;
}

/**
 * Batch form of matchCurator() for collectors that resolve hundreds of names
 * per run. Same resolution and the same end state (the first item seen for a
 * `tc:` curator names it; its logo is the first non-empty icon, filled only
 * when missing), in a fixed number of round trips: one read of the `tc:` rows,
 * then a createMany, a re-read and a logo-fill transaction only when needed.
 * Returns curator ids (or null) in input order.
 */
export async function matchCurators(
  items: { opportunityName: string; curatorData?: TurtleCurator }[]
): Promise<(string | null)[]> {
  const plans: CuratorPlan[] = [];
  for (const it of items) {
    plans.push(await planCuratorMatch(it.opportunityName, it.curatorData));
  }

  // One entry per tc: address, in first-seen order.
  const wanted = new Map<
    string,
    { name: string; website?: string; logoUrl?: string }
  >();
  plans.forEach((plan, i) => {
    if (plan?.kind !== "tc") return;
    const icon = items[i].curatorData?.iconUrl || undefined;
    const w = wanted.get(plan.address);
    if (!w) {
      wanted.set(plan.address, { name: plan.name, website: plan.website, logoUrl: icon });
    } else if (!w.logoUrl && icon) {
      w.logoUrl = icon;
    }
  });

  const idByAddress = new Map<string, string>();
  if (wanted.size > 0) {
    const addresses = [...wanted.keys()];
    const readRows = () =>
      prisma.curator.findMany({
        where: { address: { in: addresses } },
        select: { id: true, address: true, logoUrl: true },
      });
    let rows = await readRows();
    const existing = new Set(rows.map((r) => r.address));
    const missing = addresses.filter((a) => !existing.has(a));
    if (missing.length > 0) {
      await prisma.curator.createMany({
        data: missing.map((address) => {
          const w = wanted.get(address)!;
          return { address, name: w.name, website: w.website, logoUrl: w.logoUrl };
        }),
        skipDuplicates: true,
      });
      rows = await readRows();
    }
    // Fill-if-missing only, never clobber an existing logo.
    const logoFills = rows.filter((r) => !r.logoUrl && wanted.get(r.address)?.logoUrl);
    if (logoFills.length > 0) {
      await prisma.$transaction(
        logoFills.map((r) =>
          prisma.curator.update({
            where: { id: r.id },
            data: { logoUrl: wanted.get(r.address)!.logoUrl },
          })
        )
      );
    }
    for (const r of rows) idByAddress.set(r.address, r.id);
  }

  return plans.map((plan) => {
    if (plan === null) return null;
    if (plan.kind === "existing") return plan.id;
    const id = idByAddress.get(plan.address);
    if (!id) throw new Error(`curator ${plan.address} missing after createMany`);
    return id;
  });
}

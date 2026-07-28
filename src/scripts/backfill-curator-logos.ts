/**
 * Curator logo backfill/repair. Sources, in priority order:
 *   1. Morpho's first-party CDN images (api.morpho.org curators query)
 *   2. Turtle's per-opportunity curator iconUrl
 *   3. unavatar.io from the curator's Twitter handle — validated
 *
 * Rules:
 *   - A working non-unavatar logo is never overwritten.
 *   - Existing unavatar logos are re-validated (?fallback=false): dead ones are
 *     replaced from a first-party source or cleared — a cleared logo renders
 *     the initials monogram, which beats unavatar's gray placeholder ghost
 *     (how Spark "lost" its logo on the directory).
 *   - unavatar URLs are stored WITH ?fallback=false so future avatar deaths
 *     404 → the UI's onError hides the img → monogram, automatically.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-curator-logos.ts           # dry-run report
 *   npx tsx src/scripts/backfill-curator-logos.ts --apply   # write to DB
 *
 * Also exported as runLogoBackfill() for the daily full-sync cron (non-fatal).
 */
import { prisma } from "../lib/db";
import { morphoClient } from "../lib/graphql/client";
import { fetchTurtleOpportunities } from "../lib/turtle/client";

interface MorphoCurator {
  name: string;
  image: string | null;
  addresses: { address: string }[] | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function withNoFallback(url: string): string {
  if (!url.includes("unavatar.io")) return url;
  if (url.includes("fallback=false")) return url;
  return url + (url.includes("?") ? "&" : "?") + "fallback=false";
}

/** True when the URL serves a real image (2xx + image/*). HEAD first, GET as
 *  fallback for hosts that reject HEAD. */
async function isLiveImage(url: string): Promise<boolean> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(url, { method, redirect: "follow", signal: ctl.signal });
      clearTimeout(t);
      if (res.ok && (res.headers.get("content-type") ?? "").startsWith("image/")) {
        return true;
      }
      if (res.status !== 405 && res.status !== 501) return false; // definitive
    } catch {
      return false;
    }
  }
  return false;
}

export interface LogoBackfillResult {
  total: number;
  hadLogo: number;
  set: number;
  replacedDead: number;
  clearedDead: number;
  stillMissing: string[];
}

export async function runLogoBackfill(apply: boolean): Promise<LogoBackfillResult> {
  // ── Source 1: Morpho first-party curator images ──
  const morphoByAddress = new Map<string, string>();
  const morphoByName = new Map<string, string>();
  try {
    const data = await morphoClient.request<{ curators: { items: MorphoCurator[] } }>(
      `{ curators(first: 100) { items { name image addresses { address } } } }`
    );
    for (const c of data.curators.items) {
      // Morpho's catalog contains a placeholder TEST asset — never use it.
      if (!c.image || /\/test\.\w+$/i.test(c.image)) continue;
      morphoByName.set(norm(c.name), c.image);
      for (const a of c.addresses ?? []) {
        morphoByAddress.set(a.address.toLowerCase(), c.image);
      }
    }
    console.log(`[LOGOS] Morpho images: ${morphoByName.size} curators`);
  } catch (e) {
    console.error("[LOGOS] Morpho curator fetch failed (continuing):", e);
  }

  // ── Source 2: Turtle curator iconUrl ──
  const turtleByName = new Map<string, string>();
  try {
    const opps = await fetchTurtleOpportunities();
    for (const o of opps) {
      if (o.curator?.name && o.curator.iconUrl) {
        turtleByName.set(norm(o.curator.name), o.curator.iconUrl);
      }
    }
    console.log(`[LOGOS] Turtle icons: ${turtleByName.size} curators`);
  } catch (e) {
    console.error("[LOGOS] Turtle fetch failed (continuing):", e);
  }

  const curators = await prisma.curator.findMany({
    select: { id: true, address: true, name: true, logoUrl: true, twitter: true },
    orderBy: { totalAssetsManaged: "desc" },
  });

  const result: LogoBackfillResult = {
    total: curators.length,
    hadLogo: curators.filter((c) => !!c.logoUrl).length,
    set: 0,
    replacedDead: 0,
    clearedDead: 0,
    stillMissing: [],
  };

  const firstParty = (c: { address: string; name: string | null }): string | null => {
    const byAddr = morphoByAddress.get(c.address.toLowerCase());
    if (byAddr) return byAddr;
    if (!c.name) return null;
    const n = norm(c.name);
    const direct = morphoByName.get(n) ?? turtleByName.get(n);
    if (direct) return direct;
    // Unique prefix match for naming drift ("Spark Protocol" vs "Spark").
    // Prefix-only with a 5-char floor: substring matching proved too loose
    // (vault-flavored curator names picked up unrelated source logos).
    const loose: string[] = [];
    for (const [srcName, url] of [...morphoByName, ...turtleByName]) {
      if (srcName.length < 5 || n.length < 5) continue;
      if (url.toLowerCase().includes("/test")) continue; // Morpho test asset
      if (n.startsWith(srcName) || srcName.startsWith(n)) loose.push(url);
    }
    return new Set(loose).size === 1 ? loose[0] : null;
  };

  for (const c of curators) {
    const label = c.name ?? c.address;
    const existing = c.logoUrl ?? "";
    const isUnavatar = existing.includes("unavatar.io");

    // Working non-unavatar logo → leave it alone.
    if (existing && !isUnavatar) continue;

    // Existing unavatar logo: re-validate strictly (no placeholder fallback).
    if (existing && isUnavatar) {
      const strict = withNoFallback(existing);
      if (await isLiveImage(strict)) {
        // Alive — just make sure the stored URL can't regress to the gray ghost.
        if (strict !== existing && apply) {
          await prisma.curator.update({ where: { id: c.id }, data: { logoUrl: strict } });
        }
        continue;
      }
      const replacement = firstParty(c);
      if (replacement && (await isLiveImage(replacement))) {
        console.log(`[LOGOS] REPLACE dead unavatar → ${label}: ${replacement}`);
        if (apply) {
          await prisma.curator.update({ where: { id: c.id }, data: { logoUrl: replacement } });
        }
        result.replacedDead++;
      } else {
        console.log(`[LOGOS] CLEAR dead unavatar → ${label} (monogram fallback)`);
        if (apply) {
          await prisma.curator.update({ where: { id: c.id }, data: { logoUrl: null } });
        }
        result.clearedDead++;
      }
      continue;
    }

    // No logo: first-party sources, then validated unavatar from Twitter.
    let candidate = firstParty(c);
    if (!candidate && c.twitter) {
      const guess = `https://unavatar.io/x/${encodeURIComponent(c.twitter)}?fallback=false`;
      if (await isLiveImage(guess)) candidate = guess;
    }
    if (candidate && (await isLiveImage(candidate))) {
      console.log(`[LOGOS] SET ${label}: ${candidate}`);
      if (apply) {
        await prisma.curator.update({ where: { id: c.id }, data: { logoUrl: candidate } });
      }
      result.set++;
    } else {
      result.stillMissing.push(label);
    }
  }

  return result;
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`[LOGOS] ${apply ? "APPLY" : "DRY RUN"} — validating sources…`);
  const r = await runLogoBackfill(apply);
  console.log("─".repeat(60));
  console.log(
    `[LOGOS] total=${r.total} hadLogo=${r.hadLogo} set=${r.set} replacedDead=${r.replacedDead} clearedDead=${r.clearedDead} stillMissing=${r.stillMissing.length}`
  );
  if (r.stillMissing.length) {
    console.log(`[LOGOS] no source found for: ${r.stillMissing.slice(0, 40).join(", ")}`);
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

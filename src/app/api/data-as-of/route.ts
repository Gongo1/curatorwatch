import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import { getSourceFreshness } from "@/lib/health/freshness";
import type { DataAsOfSource } from "@/components/DataAsOf";

export const dynamic = "force-dynamic";

const CACHE_KEY = "data-as-of:v1";
const CACHE_TTL_S = 600;

/**
 * Per-source "as of" times for the <DataAsOf> stamp (home, curator, vault
 * pages). Freshness only (no quality checks), cached ~10 min.
 */
export async function GET() {
  try {
    let sources = await cacheGet<DataAsOfSource[]>(CACHE_KEY);
    if (!sources) {
      sources = (await getSourceFreshness()).map((s) => ({
        key: s.key,
        label: s.label,
        kind: s.kind,
        lastAt: s.lastAt,
        slaHours: s.slaHours,
        stale: s.stale,
      }));
      await cacheSet(CACHE_KEY, sources, CACHE_TTL_S);
    }
    return NextResponse.json(
      { sources },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" } }
    );
  } catch (error) {
    return NextResponse.json(
      { sources: [], error: error instanceof Error ? error.message : "freshness unavailable" },
      { status: 500 }
    );
  }
}

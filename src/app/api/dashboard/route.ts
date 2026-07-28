import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import { fetchAllDashboardData } from "@/lib/dashboard-queries";
import { GATE_ENABLED, FREE_RANKING_ROWS, TEASE_NAMES } from "@/lib/gate/config";

/**
 * Combined dashboard endpoint — queries the database DIRECTLY in a
 * single serverless function instead of proxying to 6 separate API
 * routes (which each spawn their own function and DB connection).
 *
 * Account gate: anonymous responses carry only the free ranking rows plus
 * names-only teasers for the overlay. Truncation happens AFTER the shared
 * Redis cache read (the cache always holds the full payload), and gated
 * responses are served with private caching so the CDN can't hand one auth
 * variant to the other.
 */

interface DashboardPayload {
  curators?: {
    data?: { curators?: Array<{ name: string | null }>; [k: string]: unknown };
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

function truncateForAnon(payload: DashboardPayload): DashboardPayload {
  const inner = payload.curators?.data;
  const rows = inner?.curators;
  if (!inner || !Array.isArray(rows) || rows.length <= FREE_RANKING_ROWS) {
    return payload;
  }
  return {
    ...payload,
    curators: {
      ...payload.curators,
      data: {
        ...inner,
        curators: rows.slice(0, FREE_RANKING_ROWS),
        gate: {
          truncated: true,
          totalCount: rows.length,
          teaseNames: rows
            .slice(FREE_RANKING_ROWS, FREE_RANKING_ROWS + TEASE_NAMES)
            .map((c) => c.name)
            .filter(Boolean),
        },
      },
    },
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Anonymous users under the gate get a fixed view: the default ranking
    // only. Forcing the params server-side stops sort/search permutations from
    // being used to enumerate rows past the free window.
    const gatedAnon = GATE_ENABLED ? !(await auth()).userId : false;

    const searchParams = request.nextUrl.searchParams;
    const page = gatedAnon
      ? 1
      : Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = gatedAnon
      ? 100
      : Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const search = gatedAnon ? "" : searchParams.get("search") || "";
    const sortBy = gatedAnon ? "aum" : searchParams.get("sortBy") || "aum";
    const sortOrder = gatedAnon ? "desc" : searchParams.get("sortOrder") || "desc";

    // Auth-variant responses must not share a CDN cache entry.
    const cacheControl = GATE_ENABLED
      ? "private, max-age=0, must-revalidate"
      : "public, s-maxage=60, stale-while-revalidate=300";

    const cacheKey = `dashboard:${page}:${pageSize}:${search}:${sortBy}:${sortOrder}`;
    const cached = await cacheGet<DashboardPayload>(cacheKey);
    if (cached) {
      return NextResponse.json(gatedAnon ? truncateForAnon(cached) : cached, {
        headers: { "Cache-Control": cacheControl },
      });
    }

    const data = await fetchAllDashboardData({
      page,
      pageSize,
      search: search || undefined,
      sortBy,
      sortOrder,
    });

    const responseData = {
      success: true,
      curators: data.curators,
      changes: data.changes,
      fees: data.fees,
      yields: data.yields,
      aumGrowth: data.aumGrowth,
      coverage: data.coverage,
      apyDistribution: data.apyDistribution,
    };

    await cacheSet(cacheKey, responseData, 120);

    return NextResponse.json(
      gatedAnon ? truncateForAnon(responseData as DashboardPayload) : responseData,
      { headers: { "Cache-Control": cacheControl } }
    );
  } catch (error) {
    console.error("Dashboard combined fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

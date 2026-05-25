import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";
import { fetchAllDashboardData } from "@/lib/dashboard-queries";

/**
 * Combined dashboard endpoint — queries the database DIRECTLY in a
 * single serverless function instead of proxying to 6 separate API
 * routes (which each spawn their own function and DB connection).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
    );
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "aum";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const cacheKey = `dashboard:${page}:${pageSize}:${search}:${sortBy}:${sortOrder}`;
    const cached = await cacheGet<object>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
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
    };

    await cacheSet(cacheKey, responseData, 120);

    return NextResponse.json(responseData, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("Dashboard combined fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

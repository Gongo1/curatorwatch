import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache";

/**
 * Combined dashboard endpoint — fetches all homepage data in a single
 * serverless function to avoid 6 concurrent DB connections on Vercel.
 *
 * Proxies to the individual API routes internally using the same origin.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("pageSize") || "20";
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

    const origin = request.nextUrl.origin;

    const curatorParams = new URLSearchParams({ page, pageSize, sortBy, sortOrder });
    if (search) curatorParams.set("search", search);

    // Fetch all data SEQUENTIALLY to avoid concurrent DB connections
    const curatorsRes = await fetch(`${origin}/api/curators?${curatorParams}`);
    const curatorsData = await curatorsRes.json();

    const changesRes = await fetch(`${origin}/api/changes?hours=24&limit=0`);
    const changesData = await changesRes.json();

    const feesRes = await fetch(`${origin}/api/stats/fees-breakdown?dataSource=morpho`);
    const feesData = await feesRes.json();

    const yieldRes = await fetch(`${origin}/api/stats/yield-growth`);
    const yieldData = await yieldRes.json();

    const aumRes = await fetch(`${origin}/api/stats/aum-growth`);
    const aumData = await aumRes.json();

    const coverageRes = await fetch(`${origin}/api/stats/protocol-coverage`);
    const coverageData = await coverageRes.json();

    const responseData = {
      success: true,
      curators: curatorsData,
      changes: changesData,
      fees: feesData,
      yields: yieldData,
      aumGrowth: aumData,
      coverage: coverageData,
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

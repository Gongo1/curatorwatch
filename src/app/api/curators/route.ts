import { NextRequest, NextResponse } from "next/server";
import {
  getPaginatedCuratorAggregates,
  getCuratorSummaryStats,
} from "@/lib/curator-aggregates";
import type {
  CuratorDashboardResponse,
  CuratorDashboardItem,
} from "@/lib/types/api";

export async function GET(request: NextRequest): Promise<NextResponse<CuratorDashboardResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse pagination and search parameters
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));
    const search = searchParams.get("search") || undefined;
    const sortBy = (searchParams.get("sortBy") as "aum" | "vaults" | "name") || "aum";
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
    const dataSource = searchParams.get("dataSource") || undefined;

    const [paginatedResult, stats] = await Promise.all([
      getPaginatedCuratorAggregates({
        page,
        pageSize,
        search,
        sortBy,
        sortOrder,
        dataSource,
      }),
      getCuratorSummaryStats(),
    ]);

    const curators: CuratorDashboardItem[] = paginatedResult.curators.map((c) => ({
      curatorId: c.curatorId,
      curatorAddress: c.curatorAddress,
      name: c.name,
      logoUrl: c.logoUrl,
      website: c.website,
      twitter: c.twitter,
      jurisdiction: c.jurisdiction,
      entityType: c.entityType,
      isRegulated: c.isRegulated,
      totalAUM: c.totalAUM,
      vaultCount: c.vaultCount,
      avgApy: c.avgApy,
      avgNetApy: c.avgNetApy,
      assetDistribution: c.assetDistribution,
      protocols: c.protocols,
      networks: c.networks,
      lastActive: c.lastActive?.toISOString() ?? null,
      riskScore: c.riskScore,
      strategyType: c.strategyType,
      tvlChange30d: c.tvlChange30d,
      tvlChangePct30d: c.tvlChangePct30d,
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          curators,
          stats: {
            totalCurators: stats.totalCurators,
            totalAUM: stats.totalAUM,
            totalVaults: stats.totalVaults,
            avgApy: stats.avgApy,
          },
          pagination: {
            page: paginatedResult.page,
            pageSize: paginatedResult.pageSize,
            total: paginatedResult.total,
            totalPages: paginatedResult.totalPages,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("Error fetching curator dashboard:", {
      message: errorMessage,
      stack: errorStack,
      hasDbUrl: !!process.env.DATABASE_URL,
    });

    return NextResponse.json(
      {
        success: false,
        data: {
          curators: [],
          stats: {
            totalCurators: 0,
            totalAUM: 0,
            totalVaults: 0,
            avgApy: 0,
          },
          pagination: {
            page: 1,
            pageSize: 20,
            total: 0,
            totalPages: 0,
          },
        },
        error: `Failed to fetch curator dashboard: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

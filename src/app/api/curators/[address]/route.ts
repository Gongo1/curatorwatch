import { NextRequest, NextResponse } from "next/server";
import { fetchCuratorDetail } from "@/lib/curator-detail";
import type { CuratorDetailResponse, CuratorProfile } from "@/lib/types/api";

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<CuratorDetailResponse>> {
  try {
    const { address } = await params;
    const data = await fetchCuratorDetail(address);

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          data: {
            curator: {} as CuratorProfile,
            vaults: [],
            news: [],
          },
          error: "Curator not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data },
      {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      }
    );
  } catch (error) {
    console.error("Error fetching curator:", error);
    return NextResponse.json(
      {
        success: false,
        data: {
          curator: {} as CuratorProfile,
          vaults: [],
          news: [],
        },
        error: "Failed to fetch curator details",
      },
      { status: 500 }
    );
  }
}

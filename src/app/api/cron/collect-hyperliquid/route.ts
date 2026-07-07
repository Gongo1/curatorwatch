import { NextRequest, NextResponse } from "next/server";
import { collectHyperliquidData } from "@/scripts/collect-hyperliquid-data";
import { revalidateDataPages } from "@/lib/revalidate-pages";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const urlSecret = request.nextUrl.searchParams.get("secret");

  if (cronSecret) {
    const isValidAuth = authHeader === `Bearer ${cronSecret}`;
    const isValidQuery = urlSecret === cronSecret;

    if (!isValidAuth && !isValidQuery) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  try {
    console.log("[CRON] Starting Hyperliquid HLP collection...");

    const result = await collectHyperliquidData();

    console.log("[CRON] Hyperliquid collection complete:", {
      hlpTvlUsd: result.hlpTvlUsd,
      duration: `${(result.duration / 1000).toFixed(1)}s`,
    });

    revalidateDataPages();

    return NextResponse.json({
      success: result.success,
      message: "Hyperliquid HLP collected",
      result,
    });
  } catch (error) {
    console.error("[CRON] Hyperliquid collection failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Hyperliquid collection failed",
      },
      { status: 500 }
    );
  }
}

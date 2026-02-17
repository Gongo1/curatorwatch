import { NextRequest, NextResponse } from "next/server";
import { collectData } from "@/scripts/collect-data";

export const maxDuration = 300; // 5 minutes max for Vercel Pro
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Allow Vercel cron (uses Authorization: Bearer <secret>) or query param
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
    console.log("[CRON] Starting scheduled data collection...");

    const result = await collectData({
      fetchAll: true,
      minTvlUsd: 1000,
      skipTransactions: false,
      verbose: false,
    });

    console.log("[CRON] Collection complete:", {
      vaults: result.vaultsProcessed,
      curators: result.curatorsCreated,
      transactions: result.transactionsCollected,
      duration: `${result.duration}s`,
    });

    return NextResponse.json({
      success: true,
      message: "Data collected successfully",
      result: {
        vaultsProcessed: result.vaultsProcessed,
        curatorsCreated: result.curatorsCreated,
        transactionsCollected: result.transactionsCollected,
        changesDetected: result.changesDetected,
        duration: result.duration,
      },
    });
  } catch (error) {
    console.error("[CRON] Collection failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Collection failed",
      },
      { status: 500 }
    );
  }
}

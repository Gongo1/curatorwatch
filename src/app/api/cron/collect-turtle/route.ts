import { NextRequest, NextResponse } from "next/server";
import { collectTurtleData } from "@/scripts/collect-turtle-data";
import {
  syncDealsAndDeposits,
  type DealSyncSummary,
} from "@/lib/turtle/deal-sync";
import { revalidateDataPages } from "@/lib/revalidate-pages";

export const maxDuration = 300;
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
    console.log("[CRON] Starting Turtle data collection...");

    const result = await collectTurtleData();

    console.log("[CRON] Turtle collection complete:", {
      fetched: result.totalFetched,
      filtered: result.filtered,
      vaults: result.vaultsUpserted,
      duration: `${(result.duration / 1000).toFixed(1)}s`,
    });

    // Phase 3: deal mapping + attributed deposits. A failure here must not
    // fail the whole collection run — report it in the response instead.
    let dealSync: DealSyncSummary | null = null;
    let dealSyncError: string | null = null;
    try {
      dealSync = await syncDealsAndDeposits();
      console.log("[CRON] Deal sync complete:", dealSync);
    } catch (e) {
      dealSyncError = e instanceof Error ? e.message : "deal sync failed";
      console.error("[CRON] Deal sync failed:", e);
    }

    revalidateDataPages();

    return NextResponse.json({
      success: true,
      message: "Turtle data collected successfully",
      result: {
        totalFetched: result.totalFetched,
        filtered: result.filtered,
        vaultsUpserted: result.vaultsUpserted,
        snapshotsCreated: result.snapshotsCreated,
        vaultsAttributed: result.vaultsAttributed,
        unmatchedHidden: result.unmatchedHidden,
        duration: result.duration,
      },
      dealSync,
      dealSyncError,
    });
  } catch (error) {
    console.error("[CRON] Turtle collection failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Turtle collection failed",
      },
      { status: 500 }
    );
  }
}

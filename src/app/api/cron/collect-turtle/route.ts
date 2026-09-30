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

    // Phase 3: deal mapping + attributed deposits. Runs even when the main pass
    // failed, but any failure in either pass fails the run (HTTP 500) so a dead
    // source is visible instead of hiding behind success:true.
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

    // The collector catches a fetch failure and returns 0 rows, so 0 upserted
    // means the source is down (or every row failed), never a normal run.
    const collectError =
      result.vaultsUpserted === 0
        ? `0 Turtle vaults upserted (fetched ${result.totalFetched})${
            result.errors.length > 0 ? `: ${result.errors[0]}` : ""
          }`
        : null;
    const failed = collectError !== null || dealSyncError !== null;
    if (failed) {
      console.error("[CRON] Turtle run failed:", { collectError, dealSyncError });
    }

    return NextResponse.json(
      {
        success: !failed,
        message: failed
          ? "Turtle collection failed"
          : "Turtle data collected successfully",
        error: [collectError, dealSyncError].filter(Boolean).join("; ") || undefined,
        result: {
          totalFetched: result.totalFetched,
          filtered: result.filtered,
          vaultsUpserted: result.vaultsUpserted,
          snapshotsCreated: result.snapshotsCreated,
          vaultsAttributed: result.vaultsAttributed,
          unmatchedHidden: result.unmatchedHidden,
          crossSourceOverlaps: result.crossSourceOverlaps,
          errorCount: result.errors.length,
          errors: result.errors.slice(0, 10),
          duration: result.duration,
        },
        dealSync,
        dealSyncError,
      },
      { status: failed ? 500 : 200 }
    );
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

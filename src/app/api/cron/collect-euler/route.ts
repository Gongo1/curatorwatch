import { NextRequest, NextResponse } from "next/server";
import { collectEulerData } from "@/scripts/collect-euler-data";
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
    console.log("[CRON] Starting Euler data collection...");

    const result = await collectEulerData();

    console.log("[CRON] Euler collection complete:", {
      fetched: result.totalFetched,
      vaults: result.vaultsUpserted,
      skippedUnlabeled: result.skippedUnlabeled,
      overlaps: result.crossSourceOverlaps.length,
      errors: result.errors.length,
      duration: `${(result.duration / 1000).toFixed(1)}s`,
    });

    revalidateDataPages();

    // Fail loud: a partial run still writes what it could, but any source
    // failure turns the cron red (HTTP 500) instead of a quiet 200.
    return NextResponse.json({
      success: result.success,
      message: result.success
        ? "Euler data collected successfully"
        : `Euler collection finished with ${result.errors.length} error(s)`,
      result: {
        totalFetched: result.totalFetched,
        vaultsUpserted: result.vaultsUpserted,
        snapshotsCreated: result.snapshotsCreated,
        nameAttributed: result.nameAttributed,
        skippedUnlabeled: result.skippedUnlabeled,
        skippedUnlabeledTvlUsd: result.skippedUnlabeledTvlUsd,
        skippedDeprecated: result.skippedDeprecated,
        crossSourceOverlaps: result.crossSourceOverlaps,
        deactivatedStale: result.deactivatedStale,
        retiredTurtleDuplicates: result.retiredTurtleDuplicates,
        errors: result.errors,
        duration: result.duration,
      },
    }, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error("[CRON] Euler collection failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Euler collection failed",
      },
      { status: 500 }
    );
  }
}

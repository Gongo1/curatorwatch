import { NextRequest, NextResponse } from "next/server";
import { collectData } from "@/scripts/collect-data";
import { updateVaultGrades } from "@/scripts/update-vault-grades";
import { importRatingsData } from "@/scripts/import-risk-engine-ratings";
import { ratingsData } from "@/lib/risk-engine-data";
import { revalidateDataPages } from "@/lib/revalidate-pages";

export const maxDuration = 800; // Pro plan allows up to 900s
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

  // Check if this is a full collection request
  const fullCollection = request.nextUrl.searchParams.get("full") === "true";

  try {
    console.log(`[CRON] Starting ${fullCollection ? "full" : "light"} data collection...`);

    const result = await collectData({
      fetchAll: true,
      minTvlUsd: 1000,
      // Light collection: skip heavy operations for speed
      skipTransactions: !fullCollection,
      skipReallocations: !fullCollection,
      skipMarketAllocations: !fullCollection,
      skipLiquidations: !fullCollection,
      verbose: false,
    });

    console.log("[CRON] Collection complete:", {
      vaults: result.vaultsProcessed,
      curators: result.curatorsCreated,
      snapshots: result.snapshotsCreated,
      transactions: result.transactionsCollected,
      duration: `${result.duration}s`,
    });

    // Update vault risk scores and grades
    try {
      const gradeResult = await updateVaultGrades();
      console.log("[CRON] Vault grades updated:", gradeResult);
    } catch (gradeError) {
      console.error("[CRON] Vault grade update failed (non-fatal):", gradeError);
    }

    // Refresh the loss-anchored EL ratings from the bundled engine output
    // (idempotent upsert; refreshes when a new ratings.json is deployed).
    try {
      const r = await importRatingsData(ratingsData);
      console.log("[CRON] EL ratings imported:", { curators: r.curators, vaults: r.vaults, matched: r.matched });
    } catch (ratingError) {
      console.error("[CRON] EL rating import failed (non-fatal):", ratingError);
    }

    revalidateDataPages();

    return NextResponse.json({
      success: true,
      message: "Data collected successfully",
      result: {
        vaultsProcessed: result.vaultsProcessed,
        vaultsSkipped: result.vaultsSkipped,
        curatorsCreated: result.curatorsCreated,
        snapshotsCreated: result.snapshotsCreated,
        transactionsCollected: result.transactionsCollected,
        changesDetected: result.changesDetected,
        platformAlertsDetected: result.platformAlertsDetected,
        curatorSnapshotsCreated: result.curatorSnapshotsCreated,
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

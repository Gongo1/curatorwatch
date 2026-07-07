import { NextRequest, NextResponse } from "next/server";
import { collectData, MORPHO_CHAINS } from "@/scripts/collect-data";
import { updateVaultGrades } from "@/scripts/update-vault-grades";
import { importRatingsData } from "@/scripts/import-risk-engine-ratings";
import { ratingsData } from "@/lib/risk-engine-data";
import { revalidateDataPages } from "@/lib/revalidate-pages";
import { fetchNews } from "@/lib/news/fetch-news";
import { detectDisclosureCandidates } from "@/lib/news/disclosure-listener";
import { storePlatformAlerts } from "@/lib/curator-alert-detector";

export const maxDuration = 900; // Pro plan maximum
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

  // Cron lanes: the default lane collects Ethereum (the big one — it must
  // finish inside the function budget on its own); the "alt" lane collects
  // every other Morpho chain in a separate invocation. The 2026-07-07 18:00
  // run proved one invocation can't do both: it timed out at ~834s five
  // vaults into Base V1, and the chains after Base never ran.
  const lane = request.nextUrl.searchParams.get("lane") === "alt" ? "alt" : "core";
  const laneChainIds =
    lane === "alt"
      ? MORPHO_CHAINS.filter((c) => c.chainId !== 1).map((c) => c.chainId)
      : [1];

  try {
    console.log(`[CRON] Starting ${fullCollection ? "full" : "light"} data collection (lane: ${lane})...`);

    const result = await collectData({
      fetchAll: true,
      minTvlUsd: 1000,
      chainIds: laneChainIds,
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

    // Newswire: pull free RSS feeds and tag headlines to tracked curators.
    try {
      const news = await fetchNews();
      console.log("[CRON] News ingest:", news);
    } catch (newsError) {
      console.error("[CRON] News ingest failed (non-fatal):", newsError);
    }

    // Disclosure listener: surface possible off-chain legal/regulatory events
    // (legal-tagged news + SEC EDGAR filings naming a curator) as DISCLOSURE_CANDIDATE
    // alerts for human review. Never auto-published.
    try {
      const candidates = await detectDisclosureCandidates();
      const stored = await storePlatformAlerts(candidates);
      console.log("[CRON] Disclosure candidates:", { found: candidates.length, stored });
    } catch (disclosureError) {
      console.error("[CRON] Disclosure scan failed (non-fatal):", disclosureError);
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

import { NextRequest, NextResponse } from "next/server";
import { collectData, MORPHO_CHAINS, type MorphoGeneration } from "@/scripts/collect-data";
import { updateVaultGrades } from "@/scripts/update-vault-grades";
import { runLogoBackfill } from "@/scripts/backfill-curator-logos";
import { updateReturnsMetrics } from "@/scripts/update-returns-metrics";
import { importRatingsData } from "@/scripts/import-risk-engine-ratings";
import { ratingsData } from "@/lib/risk-engine-data";
import { revalidateDataPages } from "@/lib/revalidate-pages";
import { detectDisclosureCandidates } from "@/lib/news/disclosure-listener";
import { storePlatformAlerts } from "@/lib/curator-alert-detector";
import { withCronRun } from "@/lib/cron-run";

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

  // Cron lanes. Ethereum is split by vault generation — "core-v2" and
  // "core-v1" each run in their own invocation — and the "alt" lane collects
  // every other Morpho chain (both generations). One invocation can't hold
  // Ethereum V1 + V2: V2 alone took 400-675s and V1 ~250-340s per run in late
  // Aug 2026, against a 900s cap (the 2026-07-07 run also timed out at ~834s
  // five vaults into Base V1). No lane param = legacy "core" (Ethereum, both
  // generations) for manual runs only — it does not fit the budget.
  const laneParam = request.nextUrl.searchParams.get("lane");
  const lane =
    laneParam === "alt" || laneParam === "core-v1" || laneParam === "core-v2"
      ? laneParam
      : "core";
  const laneChainIds =
    lane === "alt"
      ? MORPHO_CHAINS.filter((c) => c.chainId !== 1).map((c) => c.chainId)
      : [1];
  const laneGenerations: MorphoGeneration[] =
    lane === "core-v1" ? ["v1"] : lane === "core-v2" ? ["v2"] : ["v2", "v1"];

  return withCronRun("collect", async () => {
    console.log(`[CRON] Starting ${fullCollection ? "full" : "light"} data collection (lane: ${lane})...`);

    const result = await collectData({
      fetchAll: true,
      minTvlUsd: 1000,
      chainIds: laneChainIds,
      generations: laneGenerations,
      // Light collection: skip heavy operations for speed
      skipTransactions: !fullCollection,
      skipReallocations: !fullCollection,
      // Market allocations + liquidations moved to their own cron
      // (/api/cron/collect-market-data) — at connection_limit=1 they don't fit
      // in the same budget as a full Ethereum collection.
      skipMarketAllocations: true,
      skipLiquidations: true,
      verbose: false,
      // Batched writes take a lane ~1-2 min; this is the backstop. Past 600s
      // no new vault chunk starts (the rest are deferred, stalest first next
      // run, and the run reports partial), leaving 300s of the 900s cap for
      // the post-collection steps.
      timeBudgetMs: 600_000,
    });

    console.log("[CRON] Collection complete:", {
      vaults: result.vaultsProcessed,
      curators: result.curatorsCreated,
      snapshots: result.snapshotsCreated,
      transactions: result.transactionsCollected,
      duration: `${result.duration}s`,
    });

    // Post-collection steps run on the ALT lane only. The core lane (Ethereum,
    // ~2/3 of the vault count) needs its whole function budget for collection —
    // on 2026-07-07/08 it repeatedly timed out mid-post-steps, which is how the
    // ratings import and returns metrics silently stalled. The alt lane's
    // collection is small (~150 vaults), leaving real headroom for these.
    // Each step still runs if an earlier one failed, but a failure is recorded
    // as a step error (run status "partial" → HTTP 500), never swallowed.
    const stepErrors: Record<string, string> = {};
    const stepError = (step: string, error: unknown) => {
      stepErrors[step] = error instanceof Error ? error.message : String(error);
      console.error(`[CRON] ${step} failed:`, error);
    };
    if (lane === "alt") {
      // Update vault risk scores and grades
      try {
        const gradeResult = await updateVaultGrades();
        console.log("[CRON] Vault grades updated:", gradeResult);
      } catch (gradeError) {
        stepError("vaultGrades", gradeError);
      }

      // Returns analytics from share-price history — one set-based SQL statement
      try {
        const returnsResult = await updateReturnsMetrics();
        console.log("[CRON] Returns metrics updated:", returnsResult);
      } catch (returnsError) {
        stepError("returnsMetrics", returnsError);
      }

      // Refresh the loss-anchored EL ratings from the bundled engine output
      // (idempotent upsert; refreshes when a new ratings.json is deployed).
      try {
        const r = await importRatingsData(ratingsData);
        console.log("[CRON] EL ratings imported:", { curators: r.curators, vaults: r.vaults, matched: r.matched });
      } catch (ratingError) {
        stepError("ratingsImport", ratingError);
      }

      // Newswire ingest moved to its own cron (/api/cron/fetch-news, vercel.json):
      // ~40 external feed fetches + per-item upserts overran this lane's budget
      // and silently killed the steps below (news was dead Jul 28–Aug 2 with no
      // signal). Isolated, it gets its own 300s budget and visible failures.

      // Curator logos: fill missing logos from first-party sources (Morpho CDN,
      // Turtle icons) and retire dead unavatar URLs — self-healing, fill-only.
      try {
        const logos = await runLogoBackfill(true);
        console.log("[CRON] Logo backfill:", {
          set: logos.set,
          replacedDead: logos.replacedDead,
          clearedDead: logos.clearedDead,
          stillMissing: logos.stillMissing.length,
        });
      } catch (logoError) {
        stepError("logoBackfill", logoError);
      }

      // Disclosure listener: surface possible off-chain legal/regulatory events
      // (legal-tagged news + SEC EDGAR filings naming a curator) as DISCLOSURE_CANDIDATE
      // alerts for human review. Never auto-published.
      try {
        const candidates = await detectDisclosureCandidates();
        const stored = await storePlatformAlerts(candidates);
        console.log("[CRON] Disclosure candidates:", { found: candidates.length, stored });
      } catch (disclosureError) {
        stepError("disclosureScan", disclosureError);
      }
    }

    revalidateDataPages();

    const summary = {
      lane,
      vaultsProcessed: result.vaultsProcessed,
      vaultsSkipped: result.vaultsSkipped,
      curatorsCreated: result.curatorsCreated,
      snapshotsCreated: result.snapshotsCreated,
      transactionsCollected: result.transactionsCollected,
      changesDetected: result.changesDetected,
      platformAlertsDetected: result.platformAlertsDetected,
      curatorSnapshotsCreated: result.curatorSnapshotsCreated,
      errorCount: result.errors.length,
      duration: result.duration,
    };

    // Fail loud: a chain/generation that failed to fetch, came back empty
    // while the DB tracks it, or failed wholesale must NOT read as success —
    // V2 sat frozen for 5 weeks behind HTTP 200s. Whatever did collect is
    // already written (and pages revalidated) above.
    if (result.sourceErrors.length > 0) {
      stepErrors.sources = `Collection failed for ${result.sourceErrors.length} source(s): ${result.sourceErrors.join("; ")}`;
    }

    return {
      rowsWritten: result.snapshotsCreated,
      stepErrors,
      body: { result: summary, sourceErrors: result.sourceErrors },
    };
  }, { lane });
}

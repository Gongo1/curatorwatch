import { NextRequest, NextResponse } from "next/server";
import { collectMarketAllocations } from "@/scripts/collect-market-allocations";
import { collectLiquidations } from "@/scripts/collect-liquidations";
import { withCronRun } from "@/lib/cron-run";

// Market allocations (~540 Morpho vaults in ~20 batched API calls) and
// liquidations (bounded pages) run here, apart from the collect cron.
export const maxDuration = 900;
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

  return withCronRun("collect-market-data", async () => {
    console.log("[CRON] Starting market-data collection (allocations + liquidations)...");
    const summary: Record<string, unknown> = {};
    const stepErrors: Record<string, string> = {};
    let rowsWritten = 0;

    // Each step runs even if the other failed, but any failure fails the run
    // loudly (non-200) so a dead source can't hide behind success:true.
    try {
      const ma = await collectMarketAllocations();
      summary.marketAllocations = ma;
      rowsWritten += ma.allocationsStored;
      console.log("[CRON] Market allocations:", ma);
      // Request failures are caught inside and counted per vault. V1 vaults no
      // longer count as errors (the batched query skips them), so any error
      // means vaults were missed this run.
      if (ma.allocationsStored === 0) {
        stepErrors.marketAllocations = `0 allocations stored (${ma.errors} vault errors)`;
      } else if (ma.errors > 0) {
        stepErrors.marketAllocations = `${ma.errors} vaults not fetched`;
      }
    } catch (error) {
      stepErrors.marketAllocations = error instanceof Error ? error.message : String(error);
      console.error("[CRON] Market allocations failed:", error);
    }

    try {
      const liq = await collectLiquidations();
      summary.liquidations = liq;
      rowsWritten += liq.stored;
      console.log("[CRON] Liquidations:", liq);
    } catch (error) {
      stepErrors.liquidations = error instanceof Error ? error.message : String(error);
      console.error("[CRON] Liquidations failed:", error);
    }

    return { rowsWritten, stepErrors, body: { summary } };
  });
}

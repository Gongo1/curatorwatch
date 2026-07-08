import { NextRequest, NextResponse } from "next/server";
import { collectMarketAllocations } from "@/scripts/collect-market-allocations";
import { collectLiquidations } from "@/scripts/collect-liquidations";

// Market allocations (~460 Morpho vaults × 1 API call each) and liquidations
// don't fit in the collect cron's budget at connection_limit=1 — they get the
// whole function to themselves here.
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

  const summary: Record<string, unknown> = {};

  try {
    console.log("[CRON] Starting market-data collection (allocations + liquidations)...");

    try {
      const ma = await collectMarketAllocations();
      summary.marketAllocations = ma;
      console.log("[CRON] Market allocations:", ma);
    } catch (error) {
      summary.marketAllocationsError = error instanceof Error ? error.message : String(error);
      console.error("[CRON] Market allocations failed (non-fatal):", error);
    }

    try {
      const liq = await collectLiquidations();
      summary.liquidations = liq;
      console.log("[CRON] Liquidations:", liq);
    } catch (error) {
      summary.liquidationsError = error instanceof Error ? error.message : String(error);
      console.error("[CRON] Liquidations failed (non-fatal):", error);
    }

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("[CRON] Market-data collection failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "failed", summary },
      { status: 500 }
    );
  }
}

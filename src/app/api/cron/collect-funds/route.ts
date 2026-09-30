import { NextRequest, NextResponse } from "next/server";
import { collectFundsData } from "@/scripts/collect-funds-data";
import { revalidateDataPages } from "@/lib/revalidate-pages";

export const maxDuration = 120;
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
    console.log("[CRON] Starting tokenized-funds collection...");

    const result = await collectFundsData();

    console.log("[CRON] Funds collection complete:", {
      funds: result.fundsUpserted,
      adopted: result.adoptedTurtleRows,
      siblingsUnlinked: result.siblingsUnlinked.length,
      duration: `${(result.duration / 1000).toFixed(1)}s`,
    });

    revalidateDataPages();

    // Fail loud: the collector catches source/upsert/totals-hygiene errors and
    // returns success:false; that must not be a 200.
    return NextResponse.json(
      {
        success: result.success,
        message: result.success
          ? "Tokenized funds collected successfully"
          : "Tokenized funds collection failed",
        result,
      },
      { status: result.success ? 200 : 500 }
    );
  } catch (error) {
    console.error("[CRON] Funds collection failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Funds collection failed",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { collectFundsData } from "@/scripts/collect-funds-data";
import { revalidateDataPages } from "@/lib/revalidate-pages";
import { withCronRun } from "@/lib/cron-run";

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

  return withCronRun("collect-funds", async () => {
    console.log("[CRON] Starting tokenized-funds collection...");

    const result = await collectFundsData();

    console.log("[CRON] Funds collection complete:", {
      funds: result.fundsUpserted,
      adopted: result.adoptedTurtleRows,
      siblingsUnlinked: result.siblingsUnlinked.length,
      duration: `${(result.duration / 1000).toFixed(1)}s`,
    });

    revalidateDataPages();

    // Fail loud: the collector catches per-fund errors and reports them here.
    return {
      rowsWritten: result.snapshotsCreated,
      ...(result.success
        ? {}
        : { stepErrors: { collect: `${result.errors.length} error(s): ${result.errors[0] ?? "unknown"}` } }),
      body: { message: "Tokenized funds collected", result },
    };
  });
}

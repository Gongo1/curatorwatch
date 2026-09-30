import { NextRequest, NextResponse } from "next/server";
import { collectUpshiftData } from "@/scripts/collect-upshift-data";
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

  return withCronRun("collect-upshift", async () => {
    console.log("[CRON] Starting Upshift data collection...");

    const result = await collectUpshiftData();

    console.log("[CRON] Upshift collection complete:", {
      fetched: result.totalFetched,
      vaults: result.vaultsUpserted,
      overlaps: result.crossSourceOverlaps.length,
      duration: `${(result.duration / 1000).toFixed(1)}s`,
    });

    if (result.vaultsUpserted > 0) revalidateDataPages();

    // Fail loud: a source failure or an empty run must not look like success.
    return {
      rowsWritten: result.snapshotsCreated,
      ...(!result.success || result.vaultsUpserted === 0
        ? {
            error:
              result.errors[0] ??
              `Upshift collection upserted 0 vaults (fetched ${result.totalFetched})`,
          }
        : {}),
      body: { message: "Upshift data collected", result },
    };
  });
}

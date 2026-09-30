import { NextRequest, NextResponse } from "next/server";
import { withCronRun } from "@/lib/cron-run";
import { alertAdminOnce, getHealthReport } from "@/lib/health/report";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Health cron (vercel.json, 04:50 + 16:50 UTC: after the market-data run and
 * before the 05:00 digest). Runs the freshness SLAs, cron run log and quality
 * assertions; any breach makes the run "partial" (HTTP 500) and emails
 * ALERT_ADMIN_EMAIL, once per breach key per UTC day.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const urlSecret = request.nextUrl.searchParams.get("secret");
    if (authHeader !== `Bearer ${cronSecret}` && urlSecret !== cronSecret) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  return withCronRun("health", async () => {
    const report = await getHealthReport();
    const stepErrors: Record<string, string> = {};
    for (const b of report.breaches) stepErrors[b.key] = b.message;

    const alert = await alertAdminOnce(report.breaches);
    if (alert.error) stepErrors.adminEmail = alert.error;
    if (report.breaches.length > 0) {
      console.error("[CRON] Health breaches:", report.breaches);
    }

    return { rowsWritten: alert.emailed.length, stepErrors, body: { report, alert } };
  });
}

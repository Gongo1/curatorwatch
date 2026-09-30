import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/cache";
import { getHealthReport, type HealthReport } from "@/lib/health/report";

export const dynamic = "force-dynamic";

const REPORT_CACHE_KEY = "health:report:v1";
const REPORT_CACHE_TTL_S = 300; // public endpoint: don't re-run the checks on every hit

/**
 * Public health: DB connectivity plus the same report the health cron enforces
 * (per-source freshness SLAs + coverage, cron run log, quality assertions).
 * HTTP 503 while anything breaches, so an external uptime monitor can alert.
 */
export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasDirectUrl: !!process.env.DIRECT_URL,
      hasMorphoUrl: !!process.env.MORPHO_API_URL,
      hasAlertAdminEmail: !!process.env.ALERT_ADMIN_EMAIL,
      nodeEnv: process.env.NODE_ENV,
    },
  };

  try {
    // Test database connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    checks.database = { connected: true, result };

    // Get counts
    const [curatorCount, vaultCount] = await Promise.all([
      prisma.curator.count(),
      prisma.vault.count(),
    ]);
    checks.counts = { curators: curatorCount, vaults: vaultCount };
  } catch (error) {
    checks.database = {
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return NextResponse.json({ success: false, checks }, { status: 500 });
  }

  try {
    let report = await cacheGet<HealthReport>(REPORT_CACHE_KEY);
    if (!report) {
      report = await getHealthReport();
      await cacheSet(REPORT_CACHE_KEY, report, REPORT_CACHE_TTL_S);
    }
    return NextResponse.json(
      { success: report.ok, checks, ...report },
      { status: report.ok ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        checks,
        error: `health report failed: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}

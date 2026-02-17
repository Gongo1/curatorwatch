import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasDirectUrl: !!process.env.DIRECT_URL,
      hasMorphoUrl: !!process.env.MORPHO_API_URL,
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

    return NextResponse.json({ success: true, checks });
  } catch (error) {
    checks.database = {
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return NextResponse.json({ success: false, checks }, { status: 500 });
  }
}

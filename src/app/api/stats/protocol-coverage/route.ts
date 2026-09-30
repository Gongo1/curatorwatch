import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EXCLUDED_CURATOR_VAULT_FILTER } from "@/lib/curator-aliases";
import { cacheGet, cacheSet } from "@/lib/cache";
import { countedVaultWhere } from "@/lib/data-quality/counting";

export async function GET() {
  try {
    const CACHE_KEY = "stats:protocol-coverage";
    const cached = await cacheGet<object>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    const vaults = await prisma.vault.findMany({
      where: { ...countedVaultWhere(), ...EXCLUDED_CURATOR_VAULT_FILTER },
      select: {
        dataSource: true,
        curatorId: true,
        curatorAddress: true,
        snapshots: {
          orderBy: { timestamp: "desc" },
          take: 1,
          select: { totalAssetsUsd: true },
        },
      },
    });

    const coverage: Record<string, { vaults: number; aum: number; curators: Set<string> }> = {};

    for (const vault of vaults) {
      const ds = vault.dataSource || "morpho";
      if (!coverage[ds]) {
        coverage[ds] = { vaults: 0, aum: 0, curators: new Set() };
      }
      coverage[ds].vaults += 1;
      coverage[ds].aum += vault.snapshots[0]?.totalAssetsUsd || 0;
      const curatorKey = vault.curatorId || vault.curatorAddress;
      if (curatorKey) {
        coverage[ds].curators.add(curatorKey.toLowerCase());
      }
    }

    const result = Object.entries(coverage).map(([dataSource, data]) => ({
      dataSource,
      vaultCount: data.vaults,
      totalAUM: data.aum,
      curatorCount: data.curators.size,
    }));

    const body = { success: true, data: result };
    await cacheSet(CACHE_KEY, body, 300);
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Error fetching protocol coverage:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch protocol coverage" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/cache";
import { EXCLUDED_CURATOR_VAULT_FILTER } from "@/lib/curator-aliases";
import { RESOLV_USR_VAULT_ADDRESSES } from "@/lib/resolv-usr-warning";
import { getISOWeek, rotateArray } from "@/lib/utils/date";
import { sanitizeApy } from "@/lib/utils/sanitize-apy";

const MIN_TVL = 5_000_000;
const FALLBACK_TVL = 1_000_000;

export async function GET() {
  try {
    const cacheKey = "vaults:featured";
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
        },
      });
    }

    const vaults = await prisma.vault.findMany({
      where: {
        grade: "high-grade",
        active: true,
        address: { notIn: RESOLV_USR_VAULT_ADDRESSES },
        ...EXCLUDED_CURATOR_VAULT_FILTER,
      },
      select: {
        address: true,
        name: true,
        symbol: true,
        assetSymbol: true,
        dataSource: true,
        riskScore: true,
        netAPR: true,
        curator: {
          select: { name: true },
        },
        snapshots: {
          orderBy: { timestamp: "desc" },
          take: 1,
          select: {
            totalAssetsUsd: true,
            avgNetApy: true,
          },
        },
      },
      orderBy: { riskScore: "desc" },
    });

    // Map to flat shape with rate + TVL
    const mapped = vaults
      .map((v) => {
        const snap = v.snapshots[0];
        if (!snap) return null;

        const tvl = snap.totalAssetsUsd;
        const isTurtle = v.dataSource === "turtle";
        const rawRate = isTurtle
          ? (v.netAPR ?? 0)
          : ((sanitizeApy(snap.avgNetApy) ?? 0) * 100);
        if (rawRate <= 0) return null;

        return {
          address: v.address,
          name: v.name,
          symbol: v.symbol,
          assetSymbol: v.assetSymbol,
          curatorName: v.curator?.name ?? null,
          dataSource: v.dataSource,
          riskScore: v.riskScore ?? 0,
          tvl,
          rate: rawRate,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    // Filter by TVL — fall back to lower threshold if too few
    let eligible = mapped.filter((v) => v.tvl >= MIN_TVL);
    if (eligible.length < 3) {
      eligible = mapped.filter((v) => v.tvl >= FALLBACK_TVL);
    }

    // Rotate by ISO week number so picks change weekly
    const week = getISOWeek(new Date());
    const rotated = rotateArray(eligible, week);

    const featured = rotated.slice(0, 3);
    const more = rotated.slice(3);

    const responseBody = { success: true, data: { featured, more } };

    await cacheSet(cacheKey, responseBody, 600);

    return NextResponse.json(responseBody, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Featured vaults error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch featured vaults" },
      { status: 500 }
    );
  }
}

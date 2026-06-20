import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getWalletPortfolio,
  getWalletActivity,
  type PortfolioToken,
  type WalletActivityItem,
} from "@/lib/turtle/portfolio-client";

// Portfolio dashboard data: a wallet's cross-protocol positions (from the public
// Turtle v2 wallet endpoint) joined to CuratorWatch's curator + risk data. Each
// position joins by opportunity_id -> Vault.turtleId (Turtle-tracked vaults) OR
// pool.id -> Vault.address (Morpho-pipeline vaults), so coverage spans both.

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export interface EnrichedPosition {
  protocolName: string;
  protocolLogoUrl?: string;
  name: string;
  type: string;
  chainId: number | null;
  netUsd: number;
  pct: number;
  matched: boolean;
  curatorAddress: string | null;
  curatorName: string | null;
  vaultGrade: string | null; // "high-grade" | "medium-grade" | "low-grade"
  curatorGrade: string | null; // engine letter grade: A+ … E | NR
  riskScore: number | null;
  supplyTokens: PortfolioToken[];
  rewardTokens: PortfolioToken[];
}

interface Concentration {
  key: string;
  label: string | null;
  netUsd: number;
  pct: number;
  positionCount: number;
}

export interface PortfolioResponse {
  success: boolean;
  data: {
    address: string;
    totalNetUsd: number;
    positionCount: number;
    matchedCount: number;
    ratedPct: number; // % of net USD in positions we can attribute to a curator
    positions: EnrichedPosition[];
    curatorConcentration: Concentration[];
    gradeBreakdown: Concentration[];
    protocolBreakdown: Concentration[];
    activity: WalletActivityItem[];
  };
  error?: string;
}

interface VaultJoinRow {
  address: string;
  turtleId: string | null;
  grade: string | null;
  riskScore: number | null;
  curatorAddress: string | null;
  curatorName: string | null;
  curatorGrade: string | null;
}

const empty = (address: string): PortfolioResponse["data"] => ({
  address,
  totalNetUsd: 0,
  positionCount: 0,
  matchedCount: 0,
  ratedPct: 0,
  positions: [],
  curatorConcentration: [],
  gradeBreakdown: [],
  protocolBreakdown: [],
  activity: [],
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<PortfolioResponse>> {
  const { address } = await params;

  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { success: false, data: empty(address), error: "Invalid EVM address" },
      { status: 400 }
    );
  }
  const addr = address.toLowerCase();

  try {
    // Fetch positions + activity in parallel. Activity is best-effort — a failure
    // there shouldn't sink the whole dashboard.
    const [portfolio, activity] = await Promise.all([
      getWalletPortfolio(addr),
      getWalletActivity(addr, { limit: 10 }).catch(() => ({
        items: [] as WalletActivityItem[],
        page: 1,
        totalPages: 1,
        total: 0,
        hasNext: false,
      })),
    ]);

    const oppIds = [
      ...new Set(portfolio.positions.map((p) => p.opportunityId).filter((x): x is string => !!x)),
    ];
    const poolAddrs = [
      ...new Set(
        portfolio.positions
          .map((p) => p.poolAddress?.toLowerCase())
          .filter((x): x is string => !!x)
      ),
    ];

    // One case-insensitive query covering both join keys + the engine letter grade.
    let rows: VaultJoinRow[] = [];
    if (oppIds.length || poolAddrs.length) {
      const byTurtle = oppIds.length
        ? Prisma.sql`v."turtleId" IN (${Prisma.join(oppIds)})`
        : Prisma.sql`FALSE`;
      const byAddr = poolAddrs.length
        ? Prisma.sql`lower(v.address) IN (${Prisma.join(poolAddrs)})`
        : Prisma.sql`FALSE`;
      rows = await prisma.$queryRaw<VaultJoinRow[]>(Prisma.sql`
        SELECT v.address,
               v."turtleId"        AS "turtleId",
               v.grade,
               v."riskScore"       AS "riskScore",
               c.address           AS "curatorAddress",
               c.name              AS "curatorName",
               cr.grade            AS "curatorGrade"
        FROM "Vault" v
        LEFT JOIN "Curator" c ON v."curatorId" = c.id
        LEFT JOIN "CuratorRating" cr ON lower(cr."curatorAddress") = lower(c.address)
        WHERE ${byTurtle} OR ${byAddr}
      `);
    }

    const byTurtleId = new Map<string, VaultJoinRow>();
    const byAddress = new Map<string, VaultJoinRow>();
    for (const r of rows) {
      if (r.turtleId) byTurtleId.set(r.turtleId, r);
      byAddress.set(r.address.toLowerCase(), r);
    }

    const totalNetUsd = portfolio.totalNetUsd || portfolio.positions.reduce((s, p) => s + p.netUsd, 0);

    const positions: EnrichedPosition[] = portfolio.positions
      .map((p) => {
        const match =
          (p.opportunityId && byTurtleId.get(p.opportunityId)) ||
          (p.poolAddress && byAddress.get(p.poolAddress.toLowerCase())) ||
          null;
        return {
          protocolName: p.protocolName,
          protocolLogoUrl: p.protocolLogoUrl,
          name: p.name,
          type: p.type,
          chainId: p.chainId,
          netUsd: p.netUsd,
          pct: totalNetUsd > 0 ? (p.netUsd / totalNetUsd) * 100 : 0,
          matched: !!match,
          curatorAddress: match?.curatorAddress ?? null,
          curatorName: match?.curatorName ?? null,
          vaultGrade: match?.grade ?? null,
          curatorGrade: match?.curatorGrade ?? null,
          riskScore: match?.riskScore ?? null,
          supplyTokens: p.supplyTokens,
          rewardTokens: p.rewardTokens,
        };
      })
      .sort((a, b) => b.netUsd - a.netUsd);

    // ── Aggregations ──
    const curatorMap = new Map<string, Concentration>();
    const gradeMap = new Map<string, Concentration>();
    const protocolMap = new Map<string, Concentration>();
    let ratedNet = 0;

    for (const p of positions) {
      // curator concentration (attributed only)
      if (p.curatorAddress) {
        ratedNet += p.netUsd;
        const c = curatorMap.get(p.curatorAddress);
        if (c) {
          c.netUsd += p.netUsd;
          c.positionCount += 1;
        } else {
          curatorMap.set(p.curatorAddress, {
            key: p.curatorAddress,
            label: p.curatorName,
            netUsd: p.netUsd,
            positionCount: 1,
          } as Concentration);
        }
      }
      // grade breakdown (unattributed → "unrated")
      const gradeKey = p.vaultGrade ?? "unrated";
      const g = gradeMap.get(gradeKey);
      if (g) {
        g.netUsd += p.netUsd;
        g.positionCount += 1;
      } else {
        gradeMap.set(gradeKey, { key: gradeKey, label: gradeKey, netUsd: p.netUsd, positionCount: 1 } as Concentration);
      }
      // protocol breakdown
      const pr = protocolMap.get(p.protocolName);
      if (pr) {
        pr.netUsd += p.netUsd;
        pr.positionCount += 1;
      } else {
        protocolMap.set(p.protocolName, { key: p.protocolName, label: p.protocolName, netUsd: p.netUsd, positionCount: 1 } as Concentration);
      }
    }

    const withPct = (m: Map<string, Concentration>): Concentration[] =>
      Array.from(m.values())
        .map((c) => ({ ...c, pct: totalNetUsd > 0 ? (c.netUsd / totalNetUsd) * 100 : 0 }))
        .sort((a, b) => b.netUsd - a.netUsd);

    const data: PortfolioResponse["data"] = {
      address: addr,
      totalNetUsd,
      positionCount: positions.length,
      matchedCount: positions.filter((p) => p.matched).length,
      ratedPct: totalNetUsd > 0 ? (ratedNet / totalNetUsd) * 100 : 0,
      positions,
      curatorConcentration: withPct(curatorMap),
      gradeBreakdown: withPct(gradeMap),
      protocolBreakdown: withPct(protocolMap),
      activity: activity.items,
    };

    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("Error building portfolio for", addr, error);
    return NextResponse.json(
      { success: false, data: empty(addr), error: "Failed to load portfolio" },
      { status: 502 }
    );
  }
}

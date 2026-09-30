/**
 * Server-side data for the curator-first lens pages (/fees, /liquidations).
 * Both render as server components with ISR, like /yields.
 */

import { prisma } from "@/lib/db";
import { EXCLUDED_CURATOR_VAULT_FILTER } from "@/lib/curator-aliases";
import { sanitizeApy } from "@/lib/utils/sanitize-apy";
import { countedVaultWhere } from "@/lib/data-quality/counting";

// ── Fees ─────────────────────────────────────────────────────────────────────

export interface CuratorFeeRow {
  address: string;
  name: string;
  annualFees: number; // annualized curator fees ($)
  tvl: number;
  avgPerfFee: number; // TVL-weighted performance fee (fraction)
  vaultCount: number;
}

export interface FeesOverview {
  totalAnnualFees: number;
  curatorsCharging: number;
  totalVaults: number;
  medianPerfFee: number; // across fee-charging vaults (fraction)
  zeroFeeVaults: number; // vaults charging no performance fee (the long 0% tail)
  rows: CuratorFeeRow[];
  // Performance-fee distribution across fee-CHARGING vaults (count + TVL per band).
  feeBands: { label: string; vaults: number; tvl: number }[];
}

/**
 * Annualized curator fees per curator. Same model as the ecosystem fees total in
 * dashboard-queries: grossApy is derived from net, and curator fee =
 * TVL*managementFee + TVL*grossApy*performanceFee. Vaults with no fees
 * contribute nothing, so the ranking naturally surfaces who actually charges.
 */
export async function fetchFeesOverview(): Promise<FeesOverview> {
  const vaults = await prisma.vault.findMany({
    where: { ...countedVaultWhere(), curatorId: { not: null }, ...EXCLUDED_CURATOR_VAULT_FILTER },
    select: {
      curatorId: true,
      performanceFee: true,
      managementFee: true,
      curator: { select: { name: true, address: true } },
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: { totalAssetsUsd: true, avgNetApy: true },
      },
    },
  });

  const byCurator = new Map<string, CuratorFeeRow & { perfWeighted: number }>();
  // Bands cover fee-CHARGING vaults only (perf > 0); the large 0% cohort is
  // tracked separately as zeroFeeVaults so it can't flatten the distribution.
  const feeBandEdges = [0.0001, 0.05, 0.1, 0.15, 0.2, 1]; // fractions
  const feeBandLabels = ["<5%", "5–10%", "10–15%", "15–20%", "20%+"];
  const feeBands = feeBandLabels.map((label) => ({ label, vaults: 0, tvl: 0 }));
  const perfFeeValues: number[] = [];
  let zeroFeeVaults = 0;

  for (const v of vaults) {
    const snap = v.snapshots[0];
    if (!snap) continue;
    const tvl = snap.totalAssetsUsd || 0;
    if (tvl < 1000) continue;

    const perf = v.performanceFee || 0;
    const mgmt = v.managementFee || 0;
    const netApy = sanitizeApy(snap.avgNetApy);
    const grossApy = perf < 1 ? (netApy + mgmt) / (1 - perf) : netApy;
    const annualFee = tvl * mgmt + tvl * grossApy * perf;

    // Fee-rate distribution — only among vaults that actually charge a fee.
    if (perf > 0) {
      perfFeeValues.push(perf);
      for (let i = 0; i < feeBandEdges.length - 1; i++) {
        if (perf >= feeBandEdges[i] && (perf < feeBandEdges[i + 1] || i === feeBandEdges.length - 2)) {
          feeBands[i].vaults++;
          feeBands[i].tvl += tvl;
          break;
        }
      }
    } else {
      zeroFeeVaults++;
    }

    const key = v.curatorId as string;
    const name = v.curator?.name || `Curator ${v.curator?.address?.slice(0, 6) ?? ""}`;
    const addr = v.curator?.address || key;
    const cur =
      byCurator.get(key) ??
      { address: addr, name, annualFees: 0, tvl: 0, avgPerfFee: 0, vaultCount: 0, perfWeighted: 0 };
    cur.annualFees += annualFee;
    cur.tvl += tvl;
    cur.vaultCount += 1;
    cur.perfWeighted += perf * tvl;
    byCurator.set(key, cur);
  }

  const rows: CuratorFeeRow[] = [...byCurator.values()]
    .map((c) => ({
      address: c.address,
      name: c.name,
      annualFees: c.annualFees,
      tvl: c.tvl,
      avgPerfFee: c.tvl > 0 ? c.perfWeighted / c.tvl : 0,
      vaultCount: c.vaultCount,
    }))
    .filter((c) => c.annualFees > 0)
    .sort((a, b) => b.annualFees - a.annualFees);

  perfFeeValues.sort((a, b) => a - b);
  const medianPerfFee = perfFeeValues.length
    ? perfFeeValues[Math.floor(perfFeeValues.length / 2)]
    : 0;

  return {
    totalAnnualFees: rows.reduce((s, r) => s + r.annualFees, 0),
    curatorsCharging: rows.length,
    totalVaults: vaults.length,
    medianPerfFee,
    zeroFeeVaults,
    rows,
    feeBands,
  };
}

// ── Liquidations ─────────────────────────────────────────────────────────────

export interface LiquidationDay {
  date: string; // YYYY-MM-DD (UTC)
  events: number;
  seizedUsd: number;
  repaidUsd: number;
  badDebtUsd: number;
}

export interface LiquidationsOverview {
  days: number;
  totalEvents: number;
  totalSeizedUsd: number;
  totalRepaidUsd: number;
  totalBadDebtUsd: number;
  daysWithBadDebt: number;
  series: LiquidationDay[]; // continuous daily series, zero-filled
}

function dayKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Liquidation events bucketed by UTC day over the trailing window (no curator framing). */
export async function fetchLiquidationsOverview(
  windowDays = 180
): Promise<LiquidationsOverview> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const events = await prisma.liquidation.findMany({
    where: { timestamp: { gte: since } },
    select: {
      timestamp: true,
      seizedAssetsUsd: true,
      repaidAssetsUsd: true,
      badDebtAssetsUsd: true,
    },
  });

  const byDay = new Map<string, LiquidationDay>();
  for (const e of events) {
    const k = dayKeyUTC(e.timestamp);
    const d =
      byDay.get(k) ?? { date: k, events: 0, seizedUsd: 0, repaidUsd: 0, badDebtUsd: 0 };
    d.events += 1;
    d.seizedUsd += e.seizedAssetsUsd || 0;
    d.repaidUsd += e.repaidAssetsUsd || 0;
    d.badDebtUsd += e.badDebtAssetsUsd || 0;
    byDay.set(k, d);
  }

  // Continuous zero-filled series so the chart x-axis is calendar-true.
  const series: LiquidationDay[] = [];
  const start = new Date(since);
  start.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i <= windowDays; i++) {
    const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const k = dayKeyUTC(day);
    series.push(byDay.get(k) ?? { date: k, events: 0, seizedUsd: 0, repaidUsd: 0, badDebtUsd: 0 });
  }

  return {
    days: windowDays,
    totalEvents: events.length,
    totalSeizedUsd: events.reduce((s, e) => s + (e.seizedAssetsUsd || 0), 0),
    totalRepaidUsd: events.reduce((s, e) => s + (e.repaidAssetsUsd || 0), 0),
    totalBadDebtUsd: events.reduce((s, e) => s + (e.badDebtAssetsUsd || 0), 0),
    daysWithBadDebt: [...byDay.values()].filter((d) => d.badDebtUsd > 0).length,
    series,
  };
}

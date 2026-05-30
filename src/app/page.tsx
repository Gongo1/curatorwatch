"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { formatCurrency } from "@/lib/utils/format";
import { CuratorIndex } from "@/components/curators/CuratorIndex";
import type { CuratorDashboardItem, CuratorDashboardStats } from "@/lib/types/api";

const CuratorTvlChart = dynamic(
  () => import("@/components/curators/CuratorTvlChart").then((m) => m.CuratorTvlChart),
  { ssr: false, loading: () => <div className="h-[310px] bg-background-subtle border border-border rounded-xl animate-pulse" /> }
);

// Categorical palette — distinct hues for the asset-mix bar (matches the chart).
const MIX_COLORS = [
  "oklch(70% 0.14 235)",
  "oklch(74% 0.13 162)",
  "oklch(80% 0.13 78)",
  "oklch(68% 0.17 18)",
  "oklch(70% 0.13 305)",
  "oklch(77% 0.11 205)",
];

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

interface ApyDistribution {
  count: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  p95: number;
  max: number;
  histEdges: number[];
  histogram: number[];
  histogramTvl: number[];
}

export default function CuratorsHome() {
  const [curators, setCurators] = useState<CuratorDashboardItem[]>([]);
  const [stats, setStats] = useState<CuratorDashboardStats | null>(null);
  const [apyDist, setApyDist] = useState<ApyDistribution | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard?page=1&pageSize=100&sortBy=aum&sortOrder=desc");
        const json = await res.json();
        if (cancelled) return;
        if (!json.curators?.success) throw new Error("Failed to load curators");
        setCurators(json.curators.data.curators);
        setStats(json.curators.data.stats);
        setApyDist(json.apyDistribution ?? null);
        setError(null);
      } catch {
        if (!cancelled) setError("Could not load curator data.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Asset mix + ecosystem grade distribution, summed from the curator list so they
  // reconcile exactly with the tracked-TVL hero (no separate, differently-scoped query).
  const mix = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    for (const c of curators)
      for (const a of c.assetDistribution) {
        map[a.symbol] = (map[a.symbol] || 0) + a.amountUsd;
        total += a.amountUsd;
      }
    const sorted = Object.entries(map).sort((x, y) => y[1] - x[1]);
    const top = sorted.slice(0, 6);
    const otherAmt = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
    const stableAmt = sorted
      .filter(([s]) => !/eth|btc/i.test(s))
      .reduce((s, [, v]) => s + v, 0);
    const segments = [
      ...top.map(([symbol, amount]) => ({ symbol, pct: total ? (amount / total) * 100 : 0 })),
      ...(otherAmt > 0 ? [{ symbol: "Other", pct: total ? (otherAmt / total) * 100 : 0 }] : []),
    ];
    return { segments, stablePct: total ? (stableAmt / total) * 100 : 0 };
  }, [curators]);

  const grade = useMemo(() => {
    const g = { high: 0, medium: 0, low: 0 };
    for (const c of curators) {
      g.high += c.gradeDistribution.high;
      g.medium += c.gradeDistribution.medium;
      g.low += c.gradeDistribution.low;
    }
    return g;
  }, [curators]);

  const largest = curators.length
    ? curators.reduce((a, b) => (b.totalAUM > a.totalAUM ? b : a))
    : null;
  const gradedTotal = grade.high + grade.medium + grade.low || 1;

  if (!loaded) {
    return <div className="h-[60vh]" />;
  }
  if (error || !stats) {
    return (
      <div className="font-mono text-sm text-text-tertiary py-16 text-center">
        {error || "No data."}
      </div>
    );
  }

  return (
    <div>
      {/* ── Hero: tracked TVL + asset mix ── */}
      <header className="grid lg:grid-cols-2 gap-8 items-end mb-6">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.12em] text-text-tertiary">
            Tracked curated TVL
          </div>
          <div className="font-mono font-semibold text-[clamp(2.6rem,7vw,4.2rem)] leading-[0.98] tracking-[-0.03em] tabular-nums my-2">
            {compactUsd(stats.totalAUM)}
          </div>
          <div className="font-mono text-sm text-text-secondary">
            across <span className="text-text-primary font-semibold">{stats.totalCurators}</span>{" "}
            curators
            <span className="text-text-muted mx-2">·</span>
            <span className="text-text-primary font-semibold">{stats.totalVaults}</span> products
            <span className="text-text-muted mx-2">·</span>
            updated every 6h
          </div>
        </div>
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="font-mono text-xs uppercase tracking-[0.06em] text-text-tertiary">
              What the {compactUsd(stats.totalAUM)} holds
            </span>
            <span className="font-mono text-xs text-accent-green tabular-nums">
              {Math.round(mix.stablePct)}% stablecoin
            </span>
          </div>
          <div className="h-3 rounded-md overflow-hidden flex bg-background-elevated">
            {mix.segments.map((s, i) => (
              <span
                key={s.symbol}
                style={{
                  width: `${s.pct}%`,
                  background: s.symbol === "Other" ? "var(--text-tertiary)" : MIX_COLORS[i % MIX_COLORS.length],
                }}
              />
            ))}
          </div>
          <div className="flex gap-x-4 gap-y-2 flex-wrap mt-3">
            {mix.segments.map((s, i) => (
              <span
                key={s.symbol}
                className={`font-mono text-xs inline-flex items-center gap-1.5 ${s.symbol === "Other" ? "text-text-tertiary" : "text-text-secondary"}`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-sm"
                  style={{ background: s.symbol === "Other" ? "var(--text-tertiary)" : MIX_COLORS[i % MIX_COLORS.length] }}
                />
                {s.symbol} {Math.round(s.pct)}%
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* ── Context strip ── */}
      <div className="flex gap-x-12 gap-y-4 flex-wrap py-4 border-y border-border-subtle mb-8">
        <Stat k="Curators" v={String(stats.totalCurators)} />
        <Stat k="Products managed" v={String(stats.totalVaults)} sub="vaults" />
        {apyDist && apyDist.count > 0 ? (
          <ApyDistViz d={apyDist} />
        ) : (
          <Stat k="Net APY" v="—" />
        )}
        {largest && <Stat k="Largest curator" v={largest.name || "—"} sub={compactUsd(largest.totalAUM)} />}
      </div>

      {/* ── TVL by curator (30d) ── */}
      <section className="mt-2">
        <SectionHead title="Tracked TVL by curator" meta="top 6 · 30 days · hover to inspect" />
        <CuratorTvlChart />
      </section>

      {/* ── Curator index ── */}
      <section className="mt-12">
        <SectionHead title="All curators" meta={`${stats.totalCurators} · ranked by TVL · search & sort`} />
        <CuratorIndex curators={curators} />
      </section>

      {/* ── Product quality ── */}
      <section className="mt-12">
        <SectionHead title="Product quality" meta="grade of every managed vault" />
        <div className="border border-border rounded-2xl bg-background-subtle p-6">
          <div className="h-4 rounded-lg overflow-hidden flex bg-background-elevated mb-4">
            <span className="bg-accent-green h-full" style={{ width: `${(grade.high / gradedTotal) * 100}%` }} />
            <span className="bg-accent-yellow h-full" style={{ width: `${(grade.medium / gradedTotal) * 100}%` }} />
            <span className="bg-accent-red h-full" style={{ width: `${(grade.low / gradedTotal) * 100}%` }} />
          </div>
          <div className="flex gap-x-8 gap-y-3 flex-wrap font-mono text-sm">
            <GradeLegend color="bg-accent-green" n={grade.high} pct={(grade.high / gradedTotal) * 100} label="High-grade" sub="pass all 10 requirements" />
            <GradeLegend color="bg-accent-yellow" n={grade.medium} pct={(grade.medium / gradedTotal) * 100} label="Medium-grade" sub="fail 1–3 requirements" />
            <GradeLegend color="bg-accent-red" n={grade.low} pct={(grade.low / gradedTotal) * 100} label="Low-grade" sub="fail 4+ requirements" />
          </div>
          <p className="font-mono text-xs text-text-tertiary mt-4 leading-relaxed">
            Across the {gradedTotal} vaults curators actively manage, the model grades each on a
            10-requirement check. The low-grade tail is where allocator due-diligence concentrates —
            and what each curator&rsquo;s profile breaks down vault by vault.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div>
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary">{k}</div>
      <div className="font-mono font-semibold text-xl tracking-tight mt-0.5 tabular-nums">
        {v}
        {sub && <span className="text-xs text-text-tertiary font-normal ml-1.5">{sub}</span>}
      </div>
    </div>
  );
}

// Net-APY spread across curated vaults — a histogram beats an average: it shows the
// cluster and the high-yield tail. Median bucket highlighted; max labels the tail.
function ApyDistViz({ d }: { d: ApyDistribution }) {
  const maxCount = Math.max(1, ...d.histogram); // bar height = vault count (shape)
  const maxTvl = Math.max(1, ...d.histogramTvl); // bar brightness = $ concentration
  const fmtM = (n: number) =>
    n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${Math.round(n / 1e6)}M`;
  return (
    <div className="min-w-[190px]">
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary">
        Net APY · {d.count} vaults
      </div>
      <div className="flex items-end gap-[3px] h-7 mt-1.5" aria-hidden="true">
        {d.histogram.map((c, i) => (
          <div
            key={i}
            className="flex-1 rounded-[2px] min-w-[6px] bg-accent-blue"
            style={{
              height: `${Math.max(10, (c / maxCount) * 100)}%`,
              opacity: 0.22 + 0.78 * (d.histogramTvl[i] / maxTvl),
            }}
            title={`${d.histEdges[i]}–${d.histEdges[i + 1] >= 100 ? "∞" : d.histEdges[i + 1]}%: ${c} vault${c === 1 ? "" : "s"} · ${fmtM(d.histogramTvl[i])}`}
          />
        ))}
      </div>
      <div className="font-mono text-[0.62rem] text-text-tertiary mt-1 tabular-nums">
        median <span className="text-text-secondary">{d.median.toFixed(1)}%</span> · 95th{" "}
        <span className="text-text-secondary">{Math.round(d.p95)}%</span> · shade = TVL
      </div>
    </div>
  );
}

function SectionHead({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-5 pb-3 border-b border-border flex-wrap">
      <span className="w-[7px] h-[7px] rounded-sm bg-accent-blue -translate-y-0.5" />
      <span className="font-display font-bold text-xl tracking-tight">{title}</span>
      <span className="font-mono text-xs text-text-tertiary ml-auto text-right">{meta}</span>
    </div>
  );
}

function GradeLegend({ color, n, pct, label, sub }: { color: string; n: number; pct: number; label: string; sub: string }) {
  return (
    <div>
      <span className={`inline-block w-2.5 h-2.5 rounded-sm mr-2 ${color}`} />
      <span className="font-semibold tabular-nums">{n}</span> {label}{" "}
      <span className="text-text-tertiary tabular-nums">({Math.round(pct)}%)</span>
      <div className="text-text-tertiary text-xs mt-0.5">{sub}</div>
    </div>
  );
}

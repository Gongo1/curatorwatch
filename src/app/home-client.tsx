"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CuratorIndex } from "@/components/curators/CuratorIndex";
import { ApyDistViz, type ApyDistribution } from "@/components/ApyDistViz";
import type { CuratorDashboardItem, CuratorDashboardStats } from "@/lib/types/api";
import { isStablecoin } from "@/lib/utils/asset-class";
import { singleManagerFlags } from "@/lib/concentration";
import { curatorSlug } from "@/lib/curator-aliases";
import { Newswire } from "@/components/news/Newswire";
import type { RecentNewsItem } from "@/lib/news/queries";

export type { ApyDistribution };

const ChartSkeleton = () => (
  <div className="h-[310px] bg-background-subtle border border-border rounded-xl animate-pulse" />
);

const CuratorTvlChart = dynamic(
  () => import("@/components/curators/CuratorTvlChart").then((m) => m.CuratorTvlChart),
  { ssr: false, loading: ChartSkeleton }
);

// The chart is below the fold: don't let its recharts chunk + data fetch
// compete with first paint. Mount it only when the section nears the viewport.
function ChartWhenVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setInView(true),
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView]);

  return <div ref={ref}>{inView ? <CuratorTvlChart /> : <ChartSkeleton />}</div>;
}

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

interface CuratorsHomeProps {
  curators: CuratorDashboardItem[];
  stats: CuratorDashboardStats;
  apyDist: ApyDistribution | null;
  news: RecentNewsItem[];
}

export function CuratorsHome({ curators, stats, apyDist, news }: CuratorsHomeProps) {
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
      .filter(([s]) => isStablecoin(s))
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

  // Single-manager concentration: stablecoins where one curator runs >=84% of the
  // asset's vault TVL — the single points of failure an allocator should see.
  const concFlags = useMemo(
    () => singleManagerFlags(curators, { thresholdPct: 84, minAssetUsd: 50_000_000 }).slice(0, 6),
    [curators]
  );

  const largest = curators.length
    ? curators.reduce((a, b) => (b.totalAUM > a.totalAUM ? b : a))
    : null;
  const gradedTotal = grade.high + grade.medium + grade.low || 1;

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

      {/* ── Newswire: one-line headline bar ── */}
      {news.length > 0 && <Newswire variant="bar" items={news} title="Newswire" />}

      {/* ── Signal strip: APY · largest · single-manager concentration ── */}
      <div className="flex gap-x-10 gap-y-4 items-end flex-wrap py-4 border-b border-border-subtle mb-10">
        {apyDist && apyDist.count > 0 && <ApyDistViz d={apyDist} />}
        {largest && <Stat k="Largest curator" v={largest.name || "—"} sub={compactUsd(largest.totalAUM)} />}
        {concFlags.length > 0 && (
          <div className="min-w-0">
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary">
              Single-manager <span className="text-text-muted normal-case tracking-normal">≥84% one curator</span>
            </div>
            <div className="flex gap-x-4 gap-y-1 flex-wrap mt-1.5 font-mono text-sm">
              {concFlags.slice(0, 4).map((f) => (
                <Link
                  key={f.symbol}
                  href={f.topCuratorAddress ? `/curator/${curatorSlug(f.topCurator, f.topCuratorAddress)}` : "#"}
                  className="group whitespace-nowrap"
                  title={`${f.symbol}: ${compactUsd(f.totalUsd)} across ${f.curatorCount} curator${f.curatorCount === 1 ? "" : "s"} — ${Math.round(f.topCuratorPct)}% with ${f.topCurator}`}
                >
                  <span className="font-semibold text-text-primary">{f.symbol}</span>{" "}
                  <span className="text-accent-yellow tabular-nums">{Math.round(f.topCuratorPct)}%</span>{" "}
                  <span className="text-text-tertiary group-hover:text-accent-blue transition-colors">
                    {f.topCurator || "—"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── TVL by curator (30d) — the first full view ── */}
      <section>
        <SectionHead title="Tracked TVL by curator" meta="top 6 · stacked · 30 days · hover to inspect" />
        <ChartWhenVisible />
      </section>

      {/* ── What a curator is ── */}
      <p className="text-sm text-text-secondary leading-relaxed max-w-[760px] mt-12 mb-6">
        A <span className="text-text-primary font-medium">curator</span> is the risk team behind a
        vault: they pick the lending markets, set exposure caps, and rebalance deposits — LPs
        delegate those decisions in exchange for yield. So the real due-diligence question
        isn&rsquo;t &ldquo;which vault?&rdquo; but &ldquo;whose judgment am I trusting?&rdquo; — this
        index tracks who curators are, what they manage, and how their products hold up under a{" "}
        <Link href="/docs" className="text-accent-blue underline underline-offset-2">
          10-requirement grading model
        </Link>
        .
      </p>

      {/* ── Curator index ── */}
      <section>
        <SectionHead title="All curators" meta="ranked by TVL · search & sort" />
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

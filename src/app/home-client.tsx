"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { CuratorIndex } from "@/components/curators/CuratorIndex";
import { ApyDistViz, type ApyDistribution } from "@/components/ApyDistViz";
import type { CuratorDashboardItem, CuratorDashboardStats } from "@/lib/types/api";
import { curatorSlug } from "@/lib/curator-aliases";
import type { HomeOverview } from "@/lib/home-overview";
import { useGate } from "@/lib/gate/GateProvider";
import { EmailDeliveryCard } from "@/components/gate/EmailDeliveryCard";
import type { RankingGateMeta } from "@/lib/gate/config";
import { Newswire } from "@/components/news/Newswire";
import type { RecentNewsItem } from "@/lib/news/queries";
import { StressStrip } from "@/components/home/StressStrip";
import type { StressPoint } from "@/lib/stress-trend";

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
  /** First-viewport aggregates — computed server-side from the FULL curator
   *  set so the public hero reconciles with total TVL even when the account
   *  gate truncates the ranking rows below. */
  overview: HomeOverview;
  /** 7-day stress readings from stored digests; null until the first edition. */
  stress?: { points: StressPoint[]; drivers: string[] } | null;
  gate?: RankingGateMeta | null;
}

export function CuratorsHome({ curators, stats, apyDist, news, overview, stress = null, gate = null }: CuratorsHomeProps) {
  const { mix, concFlags, largest } = overview;
  const { enabled: gateOn, ready: gateReady, isSignedIn } = useGate();

  // Signed-in visitors land on the same ISR shell as everyone else (truncated
  // rows when the gate is on); upgrade to the full ranking client-side. The
  // /api/dashboard call is authenticated by the session cookie.
  const [liveCurators, setLiveCurators] = useState(curators);
  const [liveGate, setLiveGate] = useState(gate);
  useEffect(() => {
    setLiveCurators(curators);
    setLiveGate(gate);
  }, [curators, gate]);
  useEffect(() => {
    if (!gateOn || !gate?.truncated || !gateReady || !isSignedIn) return;
    let active = true;
    fetch("/api/dashboard?page=1&pageSize=100&sortBy=aum&sortOrder=desc")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        const inner = j?.curators?.data;
        if (Array.isArray(inner?.curators) && inner.curators.length && !inner?.gate?.truncated) {
          setLiveCurators(
            (inner.curators as CuratorDashboardItem[]).map((c) => ({ ...c, vaults: [] }))
          );
          setLiveGate(null);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [gateOn, gateReady, isSignedIn, gate]);

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

      {/* ── Curator stress: today's read + 7-day trend ── */}
      {stress && <StressStrip points={stress.points} drivers={stress.drivers} />}

      {/* ── Newswire: one-line headline bar ── */}
      {news.length > 0 && <Newswire variant="bar" items={news} title="Newswire" />}

      {/* ── Email delivery: one-click digest opt-in + alerts pointer ── */}
      <EmailDeliveryCard />

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

      {/* ── Curator index ── */}
      <section>
        <SectionHead title="All curators" meta="ranked by TVL · search & sort" />
        <CuratorIndex curators={liveCurators} gate={liveGate} />
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

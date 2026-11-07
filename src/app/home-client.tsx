"use client";

import { useEffect, useRef, useState } from "react";
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
import { DataAsOf } from "@/components/DataAsOf";
import { Panel } from "@/components/layout/Panel";
import type { StressPoint } from "@/lib/stress-trend";
import type { StressBand } from "@/lib/stress-index";
import { Quote } from "@/components/layout/Quote";

export type { ApyDistribution };

const ChartSkeleton = () => (
  <div className="h-[310px] grid place-items-center bg-background border border-border-subtle">
    <span className="label">Loading 30-day history…</span>
  </div>
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

// Series colors for the asset-mix bar — the terminal chart palette.
const MIX_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

const BAND_TEXT: Record<StressBand, string> = {
  Calm: "text-accent-green",
  Normal: "text-accent-green",
  Elevated: "text-accent-yellow",
  Stressed: "text-accent-yellow",
  Critical: "text-accent-red",
};

interface CuratorsHomeProps {
  curators: CuratorDashboardItem[];
  stats: CuratorDashboardStats;
  apyDist: ApyDistribution | null;
  news: RecentNewsItem[];
  /** First-viewport aggregates — computed server-side from the FULL curator
   *  set so the public market line reconciles with total TVL even when the
   *  account gate truncates the ranking rows. */
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

  const today = stress?.points.length ? stress.points[stress.points.length - 1] : null;
  const band = today && (today.band as StressBand) in BAND_TEXT ? (today.band as StressBand) : null;

  return (
    <div className="space-y-1.5">
      <h1 className="sr-only">CuratorWatch — DeFi vault curator market</h1>

      {/* ── Market line: the curator market in one row of quotes ── */}
      <section aria-label="Curator market" className="panel">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Quote k="Tracked TVL" v={compactUsd(stats.totalAUM)} />
          <Quote k="Curators" v={String(stats.totalCurators)} />
          <Quote k="Vaults" v={String(stats.totalVaults)} />
          <Quote k="Stablecoin share" v={`${Math.round(mix.stablePct)}%`} />
          <Quote
            k="Stress index"
            v={today ? String(Math.round(today.score)) : "—"}
            sub={band ?? undefined}
            subClass={`label ${band ? BAND_TEXT[band] : ""}`}
            href="/digest"
          />
          <Quote
            k="Largest curator"
            v={largest?.name || "—"}
            sub={largest ? compactUsd(largest.totalAUM) : undefined}
            subClass="num text-xs text-text-tertiary"
            text
          />
        </dl>
        <div className="border-t border-border px-3 py-1.5">
          <DataAsOf />
        </div>
      </section>

      {/* ── Ranking + its history (the work) | market context + flow ── */}
      <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_23rem] items-start">
        <div className="grid gap-1.5 min-w-0">
          <Panel
            title="Curator ranking"
            meta={`${gate?.totalCount ?? liveCurators.length} curators · by TVL`}
          >
            <CuratorIndex curators={liveCurators} gate={liveGate} totalAUM={stats.totalAUM} />
          </Panel>
          <Panel title="Tracked TVL by curator" meta="top 6 · stacked · 30 days" bodyClassName="p-3">
            <ChartWhenVisible />
          </Panel>
          {news.length > 0 && <Newswire variant="bar" items={news} limit={6} title="Newswire" />}
        </div>

        <div className="grid gap-1.5">
          {stress && (
            <Panel title="Curator stress" href="/digest" meta="7 days · nightly">
              <StressStrip points={stress.points} drivers={stress.drivers} />
            </Panel>
          )}

          <Panel title="Asset mix" meta={`of ${compactUsd(stats.totalAUM)}`} bodyClassName="p-3">
            <div className="h-2.5 flex bg-background" aria-hidden="true">
              {mix.segments.map((s, i) => (
                <span
                  key={s.symbol}
                  style={{
                    width: `${s.pct}%`,
                    background: s.symbol === "Other" ? "var(--text-muted)" : MIX_COLORS[i % MIX_COLORS.length],
                  }}
                />
              ))}
            </div>
            <table className="w-full mt-2.5 text-sm">
              <caption className="sr-only">Share of tracked TVL by asset</caption>
              <tbody>
                {mix.segments.map((s, i) => (
                  <tr key={s.symbol} className="h-6">
                    <td className="w-4">
                      <span
                        className="block w-2 h-2"
                        style={{ background: s.symbol === "Other" ? "var(--text-muted)" : MIX_COLORS[i % MIX_COLORS.length] }}
                      />
                    </td>
                    <td className={s.symbol === "Other" ? "text-text-tertiary" : "text-text-primary"}>{s.symbol}</td>
                    <td className="num text-right text-text-secondary">{s.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {concFlags.length > 0 && (
            <Panel title="Single-manager assets" meta="≥84% with one curator">
              <table className="w-full text-sm table-fixed">
                <caption className="sr-only">Assets where one curator manages at least 84% of tracked supply</caption>
                <thead>
                  <tr className="h-7 border-b border-border-subtle">
                    <th scope="col" className="label text-left pl-3 w-[28%]">Asset</th>
                    <th scope="col" className="label text-left">Curator</th>
                    <th scope="col" className="label text-right pr-3 w-[18%]">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {concFlags.slice(0, 5).map((f) => (
                    <tr key={f.symbol} className="h-7 border-b border-border-subtle last:border-0 hover:bg-background-hover">
                      <td className="pl-3 font-semibold text-text-primary truncate">{f.symbol}</td>
                      <td className="truncate">
                        {f.topCuratorAddress ? (
                          <Link
                            href={`/curator/${curatorSlug(f.topCurator, f.topCuratorAddress)}`}
                            className="text-text-secondary hover:text-accent-blue"
                            title={`${f.symbol}: ${compactUsd(f.totalUsd)} across ${f.curatorCount} curator${f.curatorCount === 1 ? "" : "s"}`}
                          >
                            {f.topCurator || "—"}
                          </Link>
                        ) : (
                          <span className="text-text-secondary">{f.topCurator || "—"}</span>
                        )}
                      </td>
                      <td className="num text-right pr-3 text-text-primary">{Math.round(f.topCuratorPct)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          {apyDist && apyDist.count > 0 && (
            <Panel title="Net APY spread" href="/yields" meta={`${apyDist.count} vaults`} bodyClassName="p-3">
              <ApyDistViz d={apyDist} label="Vault count by net APY band" tall />
            </Panel>
          )}
          <EmailDeliveryCard />
        </div>
      </div>

    </div>
  );
}


"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Check, Globe, GitCompare, ArrowDown, ArrowUp } from "lucide-react";
import { Newswire } from "@/components/news/Newswire";
import { CuratorBlurb } from "@/components/curators/CuratorBlurb";
import { CuratorDisclosureBanner } from "@/components/CuratorDisclosureBanner";
import { CuratorDepositors } from "@/components/CuratorDepositors";
import { DataAsOf } from "@/components/DataAsOf";
import { ApyDistViz, buildApyDistribution } from "@/components/ApyDistViz";
import { NotCountedNote } from "@/components/NotCountedNote";
import { Panel } from "@/components/layout/Panel";
import { FnTag } from "@/components/layout/FnTag";
import { usePortfolio } from "@/hooks/usePortfolio";
import { formatCurrency, formatTimeAgo } from "@/lib/utils/format";
import type {
  CuratorDetailResponse,
  CuratorVaultSummary,
  CuratorAumPoint,
  CuratorTimelineEntry,
} from "@/lib/types/api";

function initials(name: string): string {
  return name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
type VSortKey = "name" | "asset" | "protocol" | "tvl" | "apy" | "fee";

// Absolute UTC freshness stamp, e.g. "Jun 11, 12:04 UTC".
function fmtAsOf(iso: string): string {
  return (
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }) + " UTC"
  );
}

// Net APY as a fraction. avgNetApy is already a fraction; netAPR is a
// percentage, so it must be divided. Both are sanitized upstream
// (curator-detail), so an implausible APY arrives null → 0 here → "—".
const netApyOf = (v: CuratorVaultSummary): number => {
  const frac = v.latestSnapshot?.avgNetApy;
  if (frac != null) return frac;
  return v.netAPR != null ? v.netAPR / 100 : 0;
};
const tvlOf = (v: CuratorVaultSummary): number => v.latestSnapshot?.totalAssetsUsd ?? 0;

interface CuratorProfileViewProps {
  data: CuratorDetailResponse["data"];
}

export function CuratorProfileView({ data }: CuratorProfileViewProps) {
  const { isCuratorTracked, trackCurator, untrackCurator } = usePortfolio();
  const [vsort, setVsort] = useState<{ k: VSortKey; dir: 1 | -1 }>({ k: "tvl", dir: -1 });

  const { vaults } = data;
  // Every vault is listed below, but only counted ones feed the totals
  // (wrappers, bridged copies, stale rows, … carry a note instead).
  const countedVaults = vaults.filter((v) => v.counting?.counted !== false);
  const totalTVL = countedVaults.reduce((s, v) => s + tvlOf(v), 0);
  const assetMap: Record<string, number> = {};
  const networks = new Set<string>();
  const sources = new Set<string>();
  let annualYield = 0;
  for (const v of countedVaults) {
    assetMap[v.asset.symbol] = (assetMap[v.asset.symbol] || 0) + tvlOf(v);
    networks.add(v.chainName ?? "Ethereum");
    sources.add(v.dataSource ?? "morpho");
    annualYield += tvlOf(v) * netApyOf(v);
  }
  const assets = Object.entries(assetMap)
    .map(([symbol, amount]) => ({ symbol, amount, pct: totalTVL ? (amount / totalTVL) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
  const yieldByVault = countedVaults
    .map((v) => ({ name: v.name, apy: netApyOf(v), dollars: tvlOf(v) * netApyOf(v) }))
    .filter((x) => x.dollars > 0)
    .sort((a, b) => b.dollars - a.dollars)
    .slice(0, 8);
  const weightedApy = totalTVL ? annualYield / totalTVL : 0;
  const apyPairs = countedVaults
    .filter((v) => netApyOf(v) > 0 && tvlOf(v) > 0)
    .map((v) => ({ apy: netApyOf(v) * 100, tvl: tvlOf(v) }));
  const apyDist = apyPairs.length ? buildApyDistribution(apyPairs) : null;
  const derived = {
    apyDist,
    totalTVL,
    assets,
    networks: Array.from(networks),
    sources: Array.from(sources),
    annualYield,
    weightedApy,
    yieldByVault,
    maxYield: yieldByVault[0]?.dollars || 1,
  };

  const { curator } = data;
  const isTracked = isCuratorTracked(curator.id);
  const name = curator.name || `Curator ${curator.address.slice(0, 6)}`;

  const vaultById = new Map(vaults.map((v) => [v.id, v]));

  const creds: { label: string; muted?: boolean }[] = [];
  if (curator.jurisdiction) creds.push({ label: curator.jurisdiction });
  if (curator.entityType) creds.push({ label: curator.entityType });
  if (curator.foundedYear) creds.push({ label: `Est. ${curator.foundedYear}` });
  if (curator.teamSize) creds.push({ label: `Team ${curator.teamSize}` });
  creds.push(
    curator.isRegulated
      ? { label: curator.regulatoryBody ? `Regulated · ${curator.regulatoryBody}` : "Regulated" }
      : { label: "Not regulated", muted: true }
  );

  const sortedVaults = [...vaults].sort((a, b) => {
    const dir = vsort.dir;
    if (vsort.k === "name") return a.name.toLowerCase() < b.name.toLowerCase() ? -dir : dir;
    if (vsort.k === "asset") return a.asset.symbol < b.asset.symbol ? -dir : dir;
    if (vsort.k === "protocol") return (a.protocol || "") < (b.protocol || "") ? -dir : dir;
    if (vsort.k === "fee") return ((a.performanceFee ?? 0) - (b.performanceFee ?? 0)) * dir;
    if (vsort.k === "apy") return (netApyOf(a) - netApyOf(b)) * dir;
    return (tvlOf(a) - tvlOf(b)) * dir;
  });
  const onVSort = (k: typeof vsort.k) =>
    setVsort((s) => (s.k === k ? { k, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { k, dir: k === "name" || k === "asset" || k === "protocol" ? 1 : -1 }));

  const badDebt = data.liquidationSummary?.totalBadDebtUsd ?? 0;
  const topAsset = derived.assets[0];

  return (
    <div className="space-y-1.5">
      {/* ── Security-description header: function tag, name, credentials, actions ── */}
      <header className="pb-3 border-b border-border">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-2 label flex-wrap">
          <Link href="/" className="hover:text-accent-blue transition-colors">Curators</Link>
          <span className="text-text-muted">/</span>
          <span className="text-text-secondary truncate max-w-[60vw]">{name}</span>
          {data.dataAsOf && (
            <span
              className="ml-auto inline-flex items-center gap-1.5"
              title="When the on-chain data on this page was last collected"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green flex-none" aria-hidden="true" />
              Data as of <span className="num normal-case tracking-normal font-normal text-text-secondary">{fmtAsOf(data.dataAsOf)}</span>
            </span>
          )}
        </nav>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <FnTag />
            <div className="relative w-9 h-9 flex-none bg-background-elevated border border-border grid place-items-center overflow-hidden cond font-bold text-sm text-accent-blue">
              {initials(name)}
              {curator.logoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={curator.logoUrl} alt="" width={36} height={36} loading="eager" className="absolute inset-0 w-full h-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="cond font-bold text-[1.45rem] leading-none tracking-[0.01em] text-text-primary break-words">{name}</h1>
              {(curator.legalName || curator.description) && (
                <p className="text-sm text-text-secondary mt-1.5 max-w-[75ch]">
                  {curator.legalName}
                  {curator.legalName && curator.description ? " · " : ""}
                  {curator.description}
                </p>
              )}
              <ul className="flex flex-wrap gap-1 mt-2" aria-label="Credentials">
                {creds.map((c, i) => (
                  <li
                    key={i}
                    className={`label border border-border px-1.5 py-1 ${c.muted ? "text-text-muted" : "text-text-secondary"}`}
                  >
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => (isTracked ? untrackCurator(curator.id) : trackCurator(curator.id, name))}
              aria-pressed={isTracked}
              className={`btn ${isTracked ? "btn-ghost border-accent-blue text-accent-blue" : "btn-primary"}`}
            >
              {isTracked ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
              {isTracked ? "Tracking" : "Track"}
            </button>
            <Link href={`/compare?c=${curator.address}`} className="btn btn-ghost">
              <GitCompare className="w-3.5 h-3.5" aria-hidden="true" /> Compare
            </Link>
            {curator.website && (
              <a href={curator.website} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <Globe className="w-3.5 h-3.5" aria-hidden="true" /> Website
              </a>
            )}
            {curator.twitter && (
              <a href={`https://x.com/${curator.twitter}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost normal-case">
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> @{curator.twitter}
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── Key quotes: the curator in one row ── */}
      <section aria-label="Key figures" className="panel">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Quote k="Total value locked" v={formatCurrency(derived.totalTVL)} sub={`${countedVaults.length} vaults`} />
          <Quote k="Avg net APY" v={`${(derived.weightedApy * 100).toFixed(1)}%`} sub="TVL-wtd" />
          <Quote k="Annual yield to LPs" v={formatCurrency(derived.annualYield)} />
          <Quote
            k="Top asset"
            v={topAsset ? topAsset.symbol : "—"}
            sub={topAsset ? `${Math.round(topAsset.pct)}%` : undefined}
            text
          />
          <Quote
            k="Networks"
            v={String(derived.networks.length)}
            sub={derived.networks.join(" · ")}
            subTitle={derived.networks.join(" · ")}
          />
          <Quote
            k="Bad debt"
            v={badDebt >= 0.005 ? formatCurrency(badDebt) : "None"}
            valueClass={badDebt >= 0.005 ? "down" : undefined}
          />
        </dl>
        <div className="border-t border-border px-3 py-1.5 min-h-[1.9rem]">
          <DataAsOf sources={derived.sources} />
        </div>
      </section>

      {/* ── Material off-chain disclosures the EL engine can't price (litigation, etc.) ── */}
      <CuratorDisclosureBanner address={curator.address} />

      <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_23rem] items-start">
        <div className="grid gap-1.5 min-w-0">
          {/* ── About: computed figures + curated dossier facts ── */}
          <CuratorBlurb curator={curator} vaults={countedVaults} />

          {/* ── Track record: AUM under management over time ── */}
          <Panel
            title="Track record"
            meta={
              data.aumHistory && data.aumHistory.length > 1
                ? `AUM · daily · since ${fmtDay(data.aumHistory[0].date)}`
                : "AUM over time"
            }
            bodyClassName="p-3"
          >
            <TrackRecord history={data.aumHistory ?? []} />
          </Panel>

          {/* ── Vaults managed ── */}
          <Panel title="Vaults managed" meta={`${vaults.length} vaults · sortable`}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="h-7 border-b border-border bg-background">
                    <VTh k="name" sort={vsort} onSort={onVSort} className="text-left">Vault</VTh>
                    <VTh k="asset" sort={vsort} onSort={onVSort} className="text-left">Asset</VTh>
                    <VTh k="protocol" sort={vsort} onSort={onVSort} className="text-left hidden md:table-cell">Protocol</VTh>
                    <VTh k="tvl" sort={vsort} onSort={onVSort} className="text-right">TVL</VTh>
                    <VTh k="apy" sort={vsort} onSort={onVSort} className="text-right">Net APY</VTh>
                    <VTh k="fee" sort={vsort} onSort={onVSort} className="text-right hidden sm:table-cell">Perf fee</VTh>
                  </tr>
                </thead>
                <tbody>
                  {sortedVaults.map((v) => (
                    <tr key={v.id} className="h-9 border-b border-border-subtle last:border-0 hover:bg-background-hover transition-colors group">
                      <td className="py-1.5 px-3">
                        <Link href={`/vault/${v.address}`} className="font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                          {v.name}
                        </Link>
                        {v.counting && !v.counting.counted && (
                          <div className="mt-0.5">
                            <NotCountedNote counting={v.counting} />
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-3 num text-xs text-text-secondary">{v.asset.symbol}</td>
                      <td className="py-1.5 px-3 text-xs text-text-secondary capitalize hidden md:table-cell">{v.protocol || "—"}</td>
                      <td className="py-1.5 px-3 text-right num text-text-primary whitespace-nowrap">{formatCurrency(tvlOf(v))}</td>
                      <td className="py-1.5 px-3 text-right num text-text-primary">{netApyOf(v) > 0 ? `${(netApyOf(v) * 100).toFixed(2)}%` : "—"}</td>
                      <td className="py-1.5 px-3 text-right num text-text-secondary hidden sm:table-cell">
                        {v.performanceFee != null ? `${(v.performanceFee * 100).toFixed(0)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* ── Economics: where the yield comes from ── */}
          <Panel title="Yield by vault" meta="annual $ to LPs · top 8" bodyClassName="p-3">
            {derived.yieldByVault.length === 0 ? (
              <p className="text-sm text-text-tertiary">No counted vault reports a positive net APY yet, so there is no yield to break down.</p>
            ) : (
              <>
                <div className="label mb-2">Bar = $ paid per year · figure = net APY</div>
                <div className="flex flex-col">
                  {derived.yieldByVault.map((y, i) => (
                    <div
                      // Names repeat across a curator's vaults ("Sentora USD" ×2).
                      key={`${y.name}-${i}`}
                      className="grid grid-cols-[minmax(0,8.5rem)_minmax(2rem,1fr)_auto] sm:grid-cols-[minmax(0,13rem)_1fr_auto] gap-3 items-center h-7"
                    >
                      <span className="text-sm text-text-primary truncate" title={y.name}>{y.name}</span>
                      <div className="h-2.5 bg-background">
                        <span className="block h-full" style={{ width: `${(y.dollars / derived.maxYield) * 100}%`, background: "var(--chart-1)" }} />
                      </div>
                      <span className="num text-xs text-text-secondary text-right whitespace-nowrap">
                        <b className="text-text-primary font-semibold">{formatCurrency(y.dollars)}</b>{" "}
                        <span className="inline-block w-[3.25rem]">{(y.apy * 100).toFixed(1)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>

          {/* ── Changes & alerts: what moved, when ── */}
          <Panel
            title="Changes & alerts"
            meta={`${data.timeline?.length ?? 0} · auto-detected · this curator’s vaults`}
            bodyClassName="max-h-[30rem] overflow-y-auto"
          >
            <CuratorTimeline entries={data.timeline ?? []} />
          </Panel>

          {/* ── Top depositors (live) ── */}
          <CuratorDepositors curatorAddress={curator.address} />
        </div>

        {/* ── Right rail: concentration, spread, losses, press ── */}
        <div className="grid gap-1.5 min-w-0">
          <Panel title="Asset distribution" meta={`${derived.assets.length} assets · share of TVL`} bodyClassName="p-3">
            {derived.assets.length === 0 ? (
              <p className="text-sm text-text-tertiary">No counted vaults, so there is no asset mix to show.</p>
            ) : (
              <table className="w-full text-sm">
                <caption className="sr-only">Share of this curator’s TVL by asset</caption>
                <tbody>
                  {derived.assets.slice(0, 8).map((a) => (
                    <tr key={a.symbol} className="h-7">
                      <td className="w-[4.5rem] pr-2 font-semibold text-text-primary truncate max-w-[4.5rem]">{a.symbol}</td>
                      <td>
                        <div className="h-1.5 bg-background" aria-hidden="true">
                          <span className="block h-full" style={{ width: `${a.pct}%`, background: "var(--chart-1)" }} />
                        </div>
                      </td>
                      <td className="num text-xs text-text-secondary text-right pl-2 whitespace-nowrap w-[1%]">
                        {formatCurrency(a.amount)}
                      </td>
                      <td className="num text-xs text-text-primary text-right pl-2 whitespace-nowrap w-[1%]">
                        {a.pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          {derived.apyDist && derived.apyDist.count >= 3 && (
            <Panel title="Net APY spread" meta={`${derived.apyDist.count} vaults`} bodyClassName="p-3">
              <ApyDistViz d={derived.apyDist} label="Vault count by net APY band" tall />
            </Panel>
          )}

          {/* ── Liquidations lens (inline) ── */}
          <Panel title="Liquidations" href="/liquidations" meta="markets this curator allocates to">
            {data.liquidationSummary ? (
              <dl className="text-sm">
                <KV k="All time" v={String(data.liquidationSummary.total)} />
                <KV k="Last 30 days" v={String(data.liquidationSummary.recent30d)} />
                <KV k="Repaid" v={formatCurrency(data.liquidationSummary.totalRepaidUsd)} />
                <KV k="Seized" v={formatCurrency(data.liquidationSummary.totalSeizedUsd)} />
                <KV
                  k="Bad debt"
                  v={data.liquidationSummary.totalBadDebtUsd >= 0.005 ? formatCurrency(data.liquidationSummary.totalBadDebtUsd) : "None"}
                  valueClass={data.liquidationSummary.totalBadDebtUsd >= 0.005 ? "down" : undefined}
                />
              </dl>
            ) : (
              <p className="px-3 pt-3 text-sm text-text-tertiary">No liquidation data for this curator&rsquo;s markets.</p>
            )}
            <p className="px-3 py-2.5 text-xs text-text-tertiary leading-relaxed">
              Healthy liquidations repay lenders in full; bad debt is the loss signal.
              Full event detail lives in the{" "}
              <Link href="/liquidations" className="text-accent-blue hover:underline">Liquidations lens</Link>.
            </p>
          </Panel>

          {/* ── Newswire: press naming this curator ── */}
          <Newswire
            variant="rail"
            items={data.news}
            title="Newswire"
            emptyHint={`No headlines naming ${name} yet. We scan major crypto desks every few hours.`}
          />
        </div>
      </div>
    </div>
  );
}

function Quote({
  k,
  v,
  sub,
  subTitle,
  text = false,
  valueClass,
}: {
  k: string;
  v: string;
  sub?: string;
  subTitle?: string;
  text?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="px-3 py-2.5 border-border border-b lg:border-b-0 border-r min-w-0">
      <dt className="label">{k}</dt>
      <dd className="flex items-baseline gap-2 mt-1.5 min-w-0">
        <span
          className={`${text ? "cond font-bold text-[1.3rem] truncate" : "num font-semibold text-[1.45rem]"} leading-none ${
            valueClass ?? "text-text-primary"
          }`}
        >
          {v}
        </span>
        {sub && (
          <span className={`${text ? "num text-xs" : "label"} text-text-tertiary truncate`} title={subTitle}>
            {sub}
          </span>
        )}
      </dd>
    </div>
  );
}

function KV({ k, v, valueClass = "text-text-primary" }: { k: string; v: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 h-8 px-3 border-b border-border-subtle">
      <dt className="label">{k}</dt>
      <dd className={`num ${valueClass}`}>{v}</dd>
    </div>
  );
}

function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

// Server-data SVG area chart — no chart library, nothing to lazy-load.
function TrackRecord({ history }: { history: CuratorAumPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Draw in CSS pixels (viewBox width = rendered width) so axis text stays
  // 10px at every screen width instead of scaling with the chart.
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(680);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width);
      if (w > 0) setW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [history.length]);

  if (history.length < 2) {
    return (
      <p className="text-sm text-text-tertiary">
        Not enough history yet: AUM tracking for this curator began recently.
        The chart appears once a few days of snapshots accumulate.
      </p>
    );
  }

  // viewBox geometry with padding for axis labels.
  const H = W < 480 ? 180 : 230;
  const PAD_L = 52; // room for "$180M" y-labels
  const PAD_R = 12;
  const PAD_T = 10;
  const PAD_B = 24; // room for date ticks
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const n = history.length;
  const first = history[0];
  const last = history[n - 1];
  const max = Math.max(...history.map((p) => p.aumUsd));
  const min = Math.min(...history.map((p) => p.aumUsd));
  // Pad the value range 6% each side so the line never kisses the frame, but
  // keep the real min/max as the labelled gridlines.
  const pad = (max - min) * 0.06 || max * 0.06 || 1;
  const lo = min - pad;
  const span = max - min + pad * 2 || 1;

  const x = (i: number) => PAD_L + (i / (n - 1)) * plotW;
  const y = (v: number) => PAD_T + (1 - (v - lo) / span) * plotH;

  const line = history
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.aumUsd).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${(PAD_T + plotH).toFixed(1)} L${PAD_L},${(PAD_T + plotH).toFixed(1)} Z`;

  // 4 horizontal gridlines spanning the real min→max.
  const yTicks = [0, 1, 2, 3].map((k) => min + ((max - min) * k) / 3);
  // ~5 evenly-spaced date ticks.
  const xTickCount = Math.min(5, n);
  const xTicks = Array.from({ length: xTickCount }, (_, k) =>
    Math.round((k / (xTickCount - 1)) * (n - 1))
  );

  const changePct = first.aumUsd > 0 ? ((last.aumUsd - first.aumUsd) / first.aumUsd) * 100 : 0;
  const d30 = n > 30 ? history[n - 31] : first;
  const change30Pct = d30.aumUsd > 0 ? ((last.aumUsd - d30.aumUsd) / d30.aumUsd) * 100 : 0;
  const sign = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  const tone = (v: number) => (v >= 0 ? "up" : "down");

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width; // 0..1 across full viewBox width
    const plotFrac = (frac * W - PAD_L) / plotW; // 0..1 across the plot area
    const i = Math.max(0, Math.min(n - 1, Math.round(plotFrac * (n - 1))));
    setHoverIdx(i);
  };

  const hp = hoverIdx != null ? history[hoverIdx] : null;

  return (
    <div>
      <dl className="flex gap-x-8 gap-y-2 flex-wrap mb-3">
        <Fact k="AUM today" v={compactUsd(last.aumUsd)} />
        <Fact k="30d change" v={sign(change30Pct)} valueClass={tone(change30Pct)} />
        <Fact k={`Since ${fmtDay(first.date)}`} v={sign(changePct)} valueClass={tone(changePct)} />
        <Fact k="Peak" v={compactUsd(max)} />
        <Fact k="Products" v={`${last.vaultCount} vaults`} />
      </dl>
      <div ref={boxRef} className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block overflow-visible"
          role="img"
          aria-label={`AUM from ${compactUsd(first.aumUsd)} on ${fmtDay(first.date)} to ${compactUsd(last.aumUsd)} on ${fmtDay(last.date)}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Y gridlines + labels */}
          {yTicks.map((v, k) => (
            <g key={k}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--border-subtle)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD_L - 8}
                y={y(v)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--text-tertiary)"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                {compactUsd(v)}
              </text>
            </g>
          ))}

          {/* X date ticks */}
          {xTicks.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fill="var(--text-tertiary)"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {fmtDay(history[i].date)}
            </text>
          ))}

          <path d={area} fill="var(--chart-1)" opacity="0.1" />
          <path
            d={line}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />

          {/* Hover crosshair + dot */}
          {hp && (
            <g pointerEvents="none">
              <line
                x1={x(hoverIdx as number)}
                x2={x(hoverIdx as number)}
                y1={PAD_T}
                y2={PAD_T + plotH}
                stroke="var(--border-strong)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={x(hoverIdx as number)}
                cy={y(hp.aumUsd)}
                r="3"
                fill="var(--chart-1)"
                stroke="var(--background)"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* HTML tooltip positioned in viewBox-percentage space */}
        {hp && (
          <div
            className="absolute pointer-events-none -translate-x-1/2 -translate-y-full bg-background-elevated border border-border-strong px-2 py-1 whitespace-nowrap z-10 num text-xs"
            style={{
              left: `${(x(hoverIdx as number) / W) * 100}%`,
              top: `calc(${(y(hp.aumUsd) / H) * 100}% - 8px)`,
            }}
          >
            <div className="text-text-tertiary">{fmtDay(hp.date)}</div>
            <div className="font-semibold text-text-primary">{compactUsd(hp.aumUsd)}</div>
            <div className="text-text-tertiary">{hp.vaultCount} vaults</div>
          </div>
        )}
      </div>
      <p className="text-xs text-text-tertiary mt-2">
        Daily closing AUM from CuratorWatch snapshots. Hover for any day. History
        begins when tracking began, not at the curator&rsquo;s inception.
      </p>
    </div>
  );
}

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-accent-red",
  warning: "bg-accent-yellow",
  info: "bg-accent-blue",
};

function CuratorTimeline({ entries }: { entries: CuratorTimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="p-3 text-sm text-text-tertiary">
        No detected changes or alerts yet for this curator&rsquo;s vaults.
      </p>
    );
  }
  return (
    <ol className="flex flex-col">
      {entries.map((e) => (
        <li key={`${e.source}-${e.id}`} className="flex gap-2.5 px-3 py-2 border-b border-border-subtle last:border-b-0">
          <span
            className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-none ${SEVERITY_DOT[e.severity] ?? "bg-text-tertiary"}`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-medium text-text-primary">{e.title}</span>
              {e.vaultAddress && e.vaultName && (
                <Link
                  href={`/vault/${e.vaultAddress}`}
                  className="text-xs text-text-tertiary hover:text-accent-blue transition-colors truncate"
                >
                  {e.vaultName}
                </Link>
              )}
              <span className="num text-[0.7rem] text-text-tertiary ml-auto whitespace-nowrap">
                {formatTimeAgo(e.detectedAt)}
              </span>
            </div>
            {e.description && (
              <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{e.description}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Fact({ k, v, valueClass = "text-text-primary" }: { k: string; v: string; valueClass?: string }) {
  return (
    <div>
      <dt className="label">{k}</dt>
      <dd className={`num text-sm mt-1 truncate ${valueClass}`}>{v}</dd>
    </div>
  );
}

function VTh({ k, sort, onSort, className = "", children }: { k: VSortKey; sort: { k: string; dir: number }; onSort: (k: VSortKey) => void; className?: string; children: React.ReactNode }) {
  const active = sort.k === k;
  return (
    <th scope="col" aria-sort={active ? (sort.dir < 0 ? "descending" : "ascending") : undefined} className={`px-3 font-normal ${className}`}>
      <button type="button" onClick={() => onSort(k)} className={`label whitespace-nowrap hover:text-text-primary transition-colors ${active ? "text-accent-blue" : ""}`}>
        {children}
        <span className="inline-flex w-3 justify-center align-[-2px]" aria-hidden="true">
          {active && (sort.dir < 0 ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
        </span>
      </button>
    </th>
  );
}

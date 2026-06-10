"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ExternalLink, Plus, Check, Globe, GitCompare, Wallet } from "lucide-react";
import type { DealContext } from "@/components/deposit/DealDepositDrawer";

// Wallet + deposit code loads only when a deal is first opened.
const DealDepositDrawer = dynamic(
  () =>
    import("@/components/deposit/DealDepositDrawer").then(
      (m) => m.DealDepositDrawer
    ),
  { ssr: false }
);
import { CuratorRiskProfile } from "@/components/CuratorRiskProfile";
import { CuratorDepositors } from "@/components/CuratorDepositors";
import { ApyDistViz, buildApyDistribution } from "@/components/ApyDistViz";
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
type VSortKey = "name" | "asset" | "protocol" | "grade" | "tvl" | "apy" | "fee";

// Deal links route into /deposit, which 404s unless the flag is on.
const DEPOSIT_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TURTLE_DEPOSIT === "true";

// Net APY as a fraction. avgNetApy is already a fraction; netAPR is a
// percentage, so it must be divided. Both are sanitized upstream
// (curator-detail), so an implausible APY arrives null → 0 here → "—".
const netApyOf = (v: CuratorVaultSummary): number => {
  const frac = v.latestSnapshot?.avgNetApy;
  if (frac != null) return frac;
  return v.netAPR != null ? v.netAPR / 100 : 0;
};
const tvlOf = (v: CuratorVaultSummary): number => v.latestSnapshot?.totalAssetsUsd ?? 0;
const gradeKey = (g: string | null): "high" | "medium" | "low" | null =>
  g === "high-grade" ? "high" : g === "medium-grade" ? "medium" : g === "low-grade" ? "low" : null;
const GRADE_DOT: Record<string, string> = {
  high: "bg-accent-green",
  medium: "bg-accent-yellow",
  low: "bg-accent-red",
};
const GRADE_TEXT: Record<string, string> = {
  high: "text-accent-green",
  medium: "text-accent-yellow",
  low: "text-accent-red",
};

interface CuratorProfileViewProps {
  data: CuratorDetailResponse["data"];
}

export function CuratorProfileView({ data }: CuratorProfileViewProps) {
  const { isCuratorTracked, trackCurator, untrackCurator } = usePortfolio();
  const [vsort, setVsort] = useState<{ k: VSortKey; dir: 1 | -1 }>({ k: "tvl", dir: -1 });
  const [drawerDeals, setDrawerDeals] = useState<DealContext[] | null>(null);

  const { vaults } = data;
  const totalTVL = vaults.reduce((s, v) => s + tvlOf(v), 0);
  const grade = { high: 0, medium: 0, low: 0 };
  const assetMap: Record<string, number> = {};
  const networks = new Set<string>();
  const sources = new Set<string>();
  let annualYield = 0;
  for (const v of vaults) {
    const k = gradeKey(v.grade);
    if (k) grade[k]++;
    assetMap[v.asset.symbol] = (assetMap[v.asset.symbol] || 0) + tvlOf(v);
    networks.add(v.chainName ?? "Ethereum");
    sources.add(v.dataSource ?? "morpho");
    annualYield += tvlOf(v) * netApyOf(v);
  }
  const assets = Object.entries(assetMap)
    .map(([symbol, amount]) => ({ symbol, amount, pct: totalTVL ? (amount / totalTVL) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
  const yieldByVault = vaults
    .map((v) => ({ name: v.name, apy: netApyOf(v), dollars: tvlOf(v) * netApyOf(v) }))
    .filter((x) => x.dollars > 0)
    .sort((a, b) => b.dollars - a.dollars)
    .slice(0, 8);
  const weightedApy = totalTVL ? annualYield / totalTVL : 0;
  const apyPairs = vaults
    .filter((v) => netApyOf(v) > 0 && tvlOf(v) > 0)
    .map((v) => ({ apy: netApyOf(v) * 100, tvl: tvlOf(v) }));
  const apyDist = apyPairs.length ? buildApyDistribution(apyPairs) : null;
  const derived = {
    apyDist,
    totalTVL,
    grade,
    graded: grade.high + grade.medium + grade.low,
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
  const g = derived.grade;

  // Every depositable deal this curator offers, richest first — feeds both the
  // header CTA and the per-vault Deal links.
  const curatorDeals: DealContext[] = DEPOSIT_ENABLED
    ? vaults
        .filter((v) => v.dealDepositable && v.dealOpportunityId)
        .map((v) => ({
          opportunityId: v.dealOpportunityId as string,
          vaultName: v.name,
          curatorName: name,
          assetSymbol: v.asset.symbol,
          chainName: v.chainName,
          estApr: v.dealEstApr ?? null,
          tvl: tvlOf(v),
        }))
        .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
    : [];
  const canDeposit = curatorDeals.length > 0;

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
    if (vsort.k === "grade") {
      const rank = (v: CuratorVaultSummary) => ({ high: 3, medium: 2, low: 1 }[gradeKey(v.grade) || "low"] || 0);
      return (rank(a) - rank(b)) * dir;
    }
    if (vsort.k === "fee") return ((a.performanceFee ?? 0) - (b.performanceFee ?? 0)) * dir;
    if (vsort.k === "apy") return (netApyOf(a) - netApyOf(b)) * dir;
    return (tvlOf(a) - tvlOf(b)) * dir;
  });
  const onVSort = (k: typeof vsort.k) =>
    setVsort((s) => (s.k === k ? { k, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { k, dir: k === "name" || k === "asset" || k === "protocol" ? 1 : -1 }));

  return (
    <div className="max-w-[1000px]">
      <div className="font-mono text-xs text-text-tertiary flex items-center gap-2 mb-5">
        <Link href="/" className="hover:text-text-primary transition-colors">Curators</Link>
        <span className="text-text-muted">/</span>
        <span className="text-text-secondary">{name}</span>
      </div>

      {/* ── Trust masthead ── */}
      <header className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-start mb-8">
        <div>
          <div className="flex gap-4 items-start">
            <div className="relative w-14 h-14 rounded-[13px] flex-none bg-background-elevated border border-border grid place-items-center overflow-hidden font-display font-extrabold text-xl text-accent-blue">
              {initials(name)}
              {curator.logoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={curator.logoUrl} alt="" width={56} height={56} loading="eager" className="absolute inset-0 w-full h-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-[clamp(2rem,4vw,2.9rem)] leading-[1.05] tracking-[-0.02em] break-words">{name}</h1>
              {(curator.legalName || curator.description) && (
                <p className="text-text-secondary text-sm mt-1">
                  {curator.legalName}
                  {curator.legalName && curator.description ? " · " : ""}
                  {curator.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {creds.map((c, i) => (
                  <span key={i} className={`font-mono text-xs border border-border rounded-md px-2.5 py-1 bg-background-subtle ${c.muted ? "text-text-tertiary" : "text-text-secondary"}`}>
                    {c.label}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => (isTracked ? untrackCurator(curator.id) : trackCurator(curator.id, name))}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3.5 py-1.5 border transition-colors active:translate-y-px ${isTracked ? "border-accent-blue text-accent-blue bg-accent-blue/10" : "border-border text-text-primary hover:bg-background-subtle"}`}
                >
                  {isTracked ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {isTracked ? "Tracking" : "Track"}
                </button>
                <Link
                  href={`/compare?c=${curator.address}`}
                  className="inline-flex items-center gap-1.5 text-sm rounded-lg px-3.5 py-1.5 border border-border text-text-primary hover:bg-background-subtle transition-colors"
                >
                  <GitCompare className="w-3.5 h-3.5" /> Compare
                </Link>
                {curator.website && (
                  <a href={curator.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm rounded-lg px-3.5 py-1.5 border border-border text-text-primary hover:bg-background-subtle transition-colors">
                    <Globe className="w-3.5 h-3.5" /> Website
                  </a>
                )}
                {curator.twitter && (
                  <a href={`https://x.com/${curator.twitter}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm rounded-lg px-3.5 py-1.5 border border-border text-text-primary hover:bg-background-subtle transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> @{curator.twitter}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* verdict */}
        <div className="border border-border rounded-2xl bg-background-subtle p-5">
          <div className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary">Total value locked</div>
          <div className="font-mono font-semibold text-3xl tracking-tight tabular-nums mt-0.5 mb-3">
            {formatCurrency(derived.totalTVL)} <span className="text-text-tertiary text-sm font-normal">· {vaults.length} vaults</span>
          </div>
          {canDeposit && (
            <button
              type="button"
              onClick={() => setDrawerDeals(curatorDeals)}
              className="w-full mb-4 inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-lg px-4 py-2.5 bg-cyan-500 text-[#06120f] hover:opacity-90 transition-opacity active:translate-y-px"
            >
              <Wallet className="w-4 h-4" /> Deposit into this curator
              <span className="font-mono text-xs font-normal opacity-75">
                · {curatorDeals.length} {curatorDeals.length === 1 ? "deal" : "deals"}
              </span>
            </button>
          )}
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-sm text-text-secondary">Vault grade mix</span>
            {g.low === 0 && derived.graded > 0 && (
              <span className="font-mono text-xs text-accent-green inline-flex items-center gap-1"><Check className="w-3 h-3" /> No low-grade</span>
            )}
          </div>
          <div className="h-2.5 rounded-md overflow-hidden flex bg-background-elevated" role="img" aria-label={`${g.high} high, ${g.medium} medium, ${g.low} low grade`}>
            {g.high > 0 && <span className="bg-accent-green" style={{ width: `${(g.high / derived.graded) * 100}%` }} />}
            {g.medium > 0 && <span className="bg-accent-yellow" style={{ width: `${(g.medium / derived.graded) * 100}%` }} />}
            {g.low > 0 && <span className="bg-accent-red" style={{ width: `${(g.low / derived.graded) * 100}%` }} />}
          </div>
          <div className="flex gap-4 mt-2.5 font-mono text-xs">
            <span className="text-accent-green">{g.high} High</span>
            <span className="text-accent-yellow">{g.medium} Medium</span>
            <span className={g.low ? "text-accent-red" : "text-text-tertiary"}>{g.low} Low</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border-subtle">
            <Fact k="Networks" v={derived.networks.join(" · ")} />
            <Fact
              k="Top asset"
              v={derived.assets[0] ? `${derived.assets[0].symbol} · ${Math.round(derived.assets[0].pct)}%` : "—"}
            />
            <Fact k="Avg net APY" v={`${(derived.weightedApy * 100).toFixed(1)}%`} />
            <Fact k="Annual yield" v={formatCurrency(derived.annualYield)} />
          </div>
        </div>
      </header>

      <p className="font-mono text-xs text-text-tertiary leading-relaxed max-w-[720px] mb-2">
        A curator is the risk team behind these vaults — they choose markets, set exposure caps,
        and rebalance deposits on LPs&rsquo; behalf. This page is their track record:
        what they manage, how it&rsquo;s{" "}
        <Link href="/docs" className="text-accent-blue underline underline-offset-2">graded</Link>, and what has
        changed.
      </p>

      {/* ── Track record: AUM under management over time ── */}
      <Section
        title="Track record"
        meta={
          data.aumHistory && data.aumHistory.length > 1
            ? `AUM · daily · since ${fmtDay(data.aumHistory[0].date)}`
            : "AUM over time"
        }
      >
        <TrackRecord history={data.aumHistory ?? []} />
      </Section>

      {/* ── Risk profile (inline, above the fold) ── */}
      <Section title="Risk profile" meta="peer-ranked among tracked curators">
        <CuratorRiskProfile curatorAddress={curator.address} />
      </Section>

      {/* ── Vaults managed ── */}
      <Section title="Vaults managed" meta={`${vaults.length} vaults · ${formatCurrency(derived.totalTVL)}`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[520px]">
            <thead>
              <tr>
                <VTh k="name" sort={vsort} onSort={onVSort} className="text-left">Vault</VTh>
                <VTh k="asset" sort={vsort} onSort={onVSort} className="text-left">Asset</VTh>
                <VTh k="protocol" sort={vsort} onSort={onVSort} className="text-left">Protocol</VTh>
                <VTh k="grade" sort={vsort} onSort={onVSort} className="text-left">Grade</VTh>
                <VTh k="tvl" sort={vsort} onSort={onVSort} className="text-right">TVL</VTh>
                <VTh k="apy" sort={vsort} onSort={onVSort} className="text-right">Net APY</VTh>
                <VTh k="fee" sort={vsort} onSort={onVSort} className="text-right">Perf fee</VTh>
                <th className="font-mono text-[0.62rem] uppercase tracking-[0.1em] font-medium pb-3 px-3 text-right text-text-tertiary">Deal</th>
              </tr>
            </thead>
            <tbody>
              {sortedVaults.map((v) => {
                const gk = gradeKey(v.grade);
                return (
                  <tr key={v.id} className="border-t border-border-subtle hover:bg-background-subtle transition-colors group">
                    <td className="py-3 px-3">
                      <Link href={`/vault/${v.address}`} className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                        {v.name}
                      </Link>
                    </td>
                    <td className="py-3 px-3"><span className="font-mono text-xs text-text-secondary border border-border rounded px-1.5 py-0.5">{v.asset.symbol}</span></td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs text-text-secondary capitalize">{v.protocol || "—"}</span>
                    </td>
                    <td className="py-3 px-3">
                      {gk ? (
                        <span className={`font-mono text-xs inline-flex items-center gap-1.5 ${GRADE_TEXT[gk]}`}>
                          <span className={`w-1.5 h-1.5 rounded-sm ${GRADE_DOT[gk]}`} />
                          {gk[0].toUpperCase() + gk.slice(1)}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-sm tabular-nums">{formatCurrency(tvlOf(v))}</td>
                    <td className="py-3 px-3 text-right font-mono text-sm tabular-nums">{netApyOf(v) > 0 ? `${(netApyOf(v) * 100).toFixed(2)}%` : "—"}</td>
                    <td className="py-3 px-3 text-right font-mono text-sm tabular-nums text-text-secondary">
                      {v.performanceFee != null ? `${(v.performanceFee * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {DEPOSIT_ENABLED && v.dealDepositable && v.dealOpportunityId ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDrawerDeals([
                              {
                                opportunityId: v.dealOpportunityId as string,
                                vaultName: v.name,
                                curatorName: name,
                                assetSymbol: v.asset.symbol,
                                chainName: v.chainName,
                                estApr: v.dealEstApr,
                                tvl: tvlOf(v),
                              },
                            ])
                          }
                          className="font-mono text-xs text-cyan-500 underline underline-offset-2 hover:text-cyan-400 transition-colors whitespace-nowrap"
                        >
                          Deposit{v.dealEstApr != null ? ` · ${v.dealEstApr.toFixed(1)}%` : ""}
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-text-tertiary" title="Not available as a distributor deal">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-xs text-text-tertiary mt-4">
          Grade is source-derived per vault (10-requirement model). Click a vault for its full breakdown.
          Deal links open the deposit flow for vaults available through CuratorWatch; rates shown are the
          deal&rsquo;s estimated APR from the latest sync.
        </p>
      </Section>

      {/* ── Economics: where the yield comes from ── */}
      <Section title="Economics" meta="annual yield, by vault">
        {canDeposit && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5">
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">Earn this yield yourself</div>
              <div className="font-mono text-xs text-text-tertiary mt-0.5">
                Deposit into {name}&rsquo;s vaults on-site — attributed to CuratorWatch.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDrawerDeals(curatorDeals)}
              className="flex-none inline-flex items-center gap-2 text-sm font-semibold rounded-lg px-4 py-2 bg-cyan-500 text-[#06120f] hover:opacity-90 transition-opacity active:translate-y-px"
            >
              <Wallet className="w-4 h-4" /> Deposit into this curator
            </button>
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <ECard label="Annual yield to LPs" value={formatCurrency(derived.annualYield)} accent />
          {derived.apyDist && derived.apyDist.count >= 3 ? (
            <div className="border border-border rounded-xl bg-background-subtle p-5">
              <ApyDistViz d={derived.apyDist} label={`Net APY · ${derived.apyDist.count} vaults`} />
            </div>
          ) : (
            <ECard label="Avg net APY" value={`${(derived.weightedApy * 100).toFixed(2)}%`} sub="TVL-weighted" />
          )}
          <ECard label="Vaults" value={String(vaults.length)} sub={`${derived.assets.length} assets`} />
        </div>
        <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary mb-3">Annual yield ($) by vault — bar = $ paid, figure = APY</div>
        <div className="flex flex-col gap-3">
          {derived.yieldByVault.map((y) => (
            <div key={y.name} className="grid grid-cols-[150px_1fr_140px] gap-4 items-center">
              <span className="text-sm text-text-primary truncate" title={y.name}>{y.name}</span>
              <div className="h-[18px] rounded bg-background-elevated overflow-hidden">
                <span className="block h-full" style={{ width: `${(y.dollars / derived.maxYield) * 100}%`, background: "var(--accent-blue)", opacity: 0.85 }} />
              </div>
              <span className="font-mono text-xs text-text-secondary text-right tabular-nums">
                <b className="text-text-primary font-semibold">{formatCurrency(y.dollars)}</b> <span className="text-accent-green">{(y.apy * 100).toFixed(1)}%</span>
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Asset distribution ── */}
      <Section title="Asset distribution" meta="concentration across vaults">
        <div className="flex flex-col gap-3">
          {derived.assets.slice(0, 8).map((a) => (
            <div key={a.symbol} className="grid grid-cols-[84px_1fr_150px] gap-4 items-center">
              <span className="font-mono text-sm text-text-primary">{a.symbol}</span>
              <div className="h-2 rounded bg-background-elevated overflow-hidden">
                <span className="block h-full" style={{ width: `${a.pct}%`, background: "var(--accent-blue)", opacity: 0.85 }} />
              </div>
              <span className="font-mono text-xs text-text-secondary text-right tabular-nums">
                <b className="text-text-primary font-semibold">{formatCurrency(a.amount)}</b> · {a.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Liquidations lens (inline) ── */}
      <Section title="Liquidations" meta="across markets this curator allocates to">
        {data.liquidationSummary ? (
          <div className="flex gap-x-10 gap-y-3 flex-wrap">
            <Fact k="All time" v={String(data.liquidationSummary.total)} />
            <Fact k="Last 30 days" v={String(data.liquidationSummary.recent30d)} />
            <Fact k="Repaid" v={formatCurrency(data.liquidationSummary.totalRepaidUsd)} />
            <Fact k="Seized" v={formatCurrency(data.liquidationSummary.totalSeizedUsd)} />
            <div>
              <div className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-tertiary">Bad debt</div>
              <div className={`font-mono text-sm mt-0.5 tabular-nums ${data.liquidationSummary.totalBadDebtUsd > 0 ? "text-accent-red" : "text-accent-green"}`}>
                {data.liquidationSummary.totalBadDebtUsd > 0
                  ? formatCurrency(data.liquidationSummary.totalBadDebtUsd)
                  : "None"}
              </div>
            </div>
          </div>
        ) : (
          <p className="font-mono text-sm text-text-tertiary">No liquidation data for this curator&rsquo;s markets.</p>
        )}
        <p className="font-mono text-xs text-text-tertiary mt-3">
          Healthy liquidations repay lenders in full; bad debt is the loss signal.
          Full event detail lives in the <Link href="/liquidations" className="text-accent-blue underline underline-offset-2">Liquidations lens</Link>.
        </p>
      </Section>

      {/* ── Changes & alerts: what moved, when ── */}
      <Section
        title="Changes & alerts"
        meta="auto-detected across this curator’s vaults"
      >
        <CuratorTimeline entries={data.timeline ?? []} />
      </Section>

      {/* ── Top depositors (live) ── */}
      <Section title="Top depositors" meta="across this curator’s vaults">
        <CuratorDepositors curatorAddress={curator.address} />
      </Section>

      {drawerDeals && (
        <DealDepositDrawer
          deals={drawerDeals}
          curatorName={name}
          onClose={() => setDrawerDeals(null)}
        />
      )}
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

  if (history.length < 2) {
    return (
      <p className="font-mono text-sm text-text-tertiary">
        Not enough history yet — AUM tracking for this curator began recently.
        The chart appears once a few days of snapshots accumulate.
      </p>
    );
  }

  // viewBox geometry with padding for axis labels.
  const W = 680;
  const H = 200;
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
  const tone = (v: number) => (v >= 0 ? "text-accent-green" : "text-accent-red");

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
      <div className="flex gap-x-10 gap-y-3 flex-wrap mb-4">
        <Fact k="AUM today" v={compactUsd(last.aumUsd)} />
        <div>
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-tertiary">30d change</div>
          <div className={`font-mono text-sm mt-0.5 tabular-nums ${tone(change30Pct)}`}>{sign(change30Pct)}</div>
        </div>
        <div>
          <div className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-tertiary">Since {fmtDay(first.date)}</div>
          <div className={`font-mono text-sm mt-0.5 tabular-nums ${tone(changePct)}`}>{sign(changePct)}</div>
        </div>
        <Fact k="Peak" v={compactUsd(max)} />
        <Fact k="Products" v={`${last.vaultCount} vaults`} />
      </div>
      <div className="relative border border-border rounded-2xl bg-background-subtle p-4">
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
                stroke="var(--border)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                opacity={0.5}
              />
              <text
                x={PAD_L - 8}
                y={y(v)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--text-tertiary)"
                fontSize="11"
                fontFamily="var(--font-mono, monospace)"
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
              fontSize="11"
              fontFamily="var(--font-mono, monospace)"
            >
              {fmtDay(history[i].date)}
            </text>
          ))}

          <path d={area} fill="var(--accent-blue)" opacity="0.12" />
          <path
            d={line}
            fill="none"
            stroke="var(--accent-blue)"
            strokeWidth="2"
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
                stroke="var(--accent-blue)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                opacity={0.5}
              />
              <circle
                cx={x(hoverIdx as number)}
                cy={y(hp.aumUsd)}
                r="3.5"
                fill="var(--accent-blue)"
                stroke="var(--background)"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* HTML tooltip positioned in viewBox-percentage space */}
        {hp && (
          <div
            className="absolute pointer-events-none -translate-x-1/2 -translate-y-full bg-background-elevated border border-border rounded-lg px-2.5 py-1.5 shadow-xl whitespace-nowrap z-10"
            style={{
              left: `${(x(hoverIdx as number) / W) * 100}%`,
              top: `calc(${(y(hp.aumUsd) / H) * 100}% - 8px)`,
            }}
          >
            <div className="font-mono text-[0.62rem] text-text-tertiary">{fmtDay(hp.date)}</div>
            <div className="font-mono text-sm font-semibold tabular-nums text-text-primary">
              {compactUsd(hp.aumUsd)}
            </div>
            <div className="font-mono text-[0.6rem] text-text-tertiary tabular-nums">
              {hp.vaultCount} vaults
            </div>
          </div>
        )}
      </div>
      <p className="font-mono text-xs text-text-tertiary mt-3">
        Daily closing AUM from CuratorWatch snapshots — hover for any day. History
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
      <p className="font-mono text-sm text-text-tertiary">
        No detected changes or alerts yet for this curator&rsquo;s vaults.
      </p>
    );
  }
  return (
    <ol className="flex flex-col">
      {entries.map((e) => (
        <li key={`${e.source}-${e.id}`} className="flex gap-3 py-3 border-t border-border-subtle first:border-t-0">
          <span
            className={`mt-1.5 w-2 h-2 rounded-sm flex-none ${SEVERITY_DOT[e.severity] ?? "bg-text-tertiary"}`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-medium text-text-primary">{e.title}</span>
              {e.vaultAddress && e.vaultName && (
                <Link
                  href={`/vault/${e.vaultAddress}`}
                  className="font-mono text-xs text-text-tertiary hover:text-accent-blue transition-colors truncate"
                >
                  {e.vaultName}
                </Link>
              )}
              <span className="font-mono text-xs text-text-tertiary ml-auto whitespace-nowrap">
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

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-tertiary">{k}</div>
      <div className="font-mono text-sm text-text-primary mt-0.5 tabular-nums truncate">{v}</div>
    </div>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-3 mb-5 pb-3 border-b border-border flex-wrap">
        <span className="w-[7px] h-[7px] rounded-sm bg-accent-blue -translate-y-0.5" />
        <span className="font-display font-bold text-xl tracking-tight">{title}</span>
        {meta && <span className="font-mono text-xs text-text-tertiary ml-auto text-right">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function ECard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="border border-border rounded-xl bg-background-subtle p-5">
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary">{label}</div>
      <div className={`font-mono font-semibold text-xl tracking-tight mt-1.5 tabular-nums ${accent ? "text-accent-green" : ""}`}>{value}</div>
      {sub && <div className="font-mono text-xs text-text-tertiary mt-0.5">{sub}</div>}
    </div>
  );
}

function VTh({ k, sort, onSort, className = "", children }: { k: VSortKey; sort: { k: string; dir: number }; onSort: (k: VSortKey) => void; className?: string; children: React.ReactNode }) {
  const active = sort.k === k;
  return (
    <th className={`font-mono text-[0.62rem] uppercase tracking-[0.1em] font-medium pb-3 px-3 ${className}`}>
      <button type="button" onClick={() => onSort(k)} className={`hover:text-text-primary transition-colors ${active ? "text-accent-blue" : "text-text-tertiary"}`}>
        {children}{active ? (sort.dir < 0 ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
}

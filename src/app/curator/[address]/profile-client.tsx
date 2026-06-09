"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Check, Globe } from "lucide-react";
import { CuratorRiskProfile } from "@/components/CuratorRiskProfile";
import { CuratorDepositors } from "@/components/CuratorDepositors";
import { usePortfolio } from "@/hooks/usePortfolio";
import { formatCurrency } from "@/lib/utils/format";
import type { CuratorDetailResponse, CuratorVaultSummary } from "@/lib/types/api";

function initials(name: string): string {
  return name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
const netApyOf = (v: CuratorVaultSummary): number =>
  v.latestSnapshot?.avgNetApy ?? v.netAPR ?? 0; // fraction
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
  const [vsort, setVsort] = useState<{ k: "name" | "asset" | "grade" | "tvl" | "apy"; dir: 1 | -1 }>({ k: "tvl", dir: -1 });

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
  const derived = {
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
    if (vsort.k === "grade") {
      const rank = (v: CuratorVaultSummary) => ({ high: 3, medium: 2, low: 1 }[gradeKey(v.grade) || "low"] || 0);
      return (rank(a) - rank(b)) * dir;
    }
    if (vsort.k === "apy") return (netApyOf(a) - netApyOf(b)) * dir;
    return (tvlOf(a) - tvlOf(b)) * dir;
  });
  const onVSort = (k: typeof vsort.k) =>
    setVsort((s) => (s.k === k ? { k, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { k, dir: k === "name" || k === "asset" ? 1 : -1 }));

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
                <VTh k="grade" sort={vsort} onSort={onVSort} className="text-left">Grade</VTh>
                <VTh k="tvl" sort={vsort} onSort={onVSort} className="text-right">TVL</VTh>
                <VTh k="apy" sort={vsort} onSort={onVSort} className="text-right">Net APY</VTh>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-xs text-text-tertiary mt-4">Grade is source-derived per vault (10-requirement model). Click a vault for its full breakdown.</p>
      </Section>

      {/* ── Economics: where the yield comes from ── */}
      <Section title="Economics" meta="annual yield, by vault">
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <ECard label="Annual yield to LPs" value={formatCurrency(derived.annualYield)} accent />
          <ECard label="Avg net APY" value={`${(derived.weightedApy * 100).toFixed(2)}%`} sub="TVL-weighted" />
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

      {/* ── Top depositors (live) ── */}
      <Section title="Top depositors" meta="across this curator’s vaults">
        <CuratorDepositors curatorAddress={curator.address} />
      </Section>
    </div>
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

function VTh({ k, sort, onSort, className = "", children }: { k: "name" | "asset" | "grade" | "tvl" | "apy"; sort: { k: string; dir: number }; onSort: (k: "name" | "asset" | "grade" | "tvl" | "apy") => void; className?: string; children: React.ReactNode }) {
  const active = sort.k === k;
  return (
    <th className={`font-mono text-[0.62rem] uppercase tracking-[0.1em] font-medium pb-3 px-3 ${className}`}>
      <button type="button" onClick={() => onSort(k)} className={`hover:text-text-primary transition-colors ${active ? "text-accent-blue" : "text-text-tertiary"}`}>
        {children}{active ? (sort.dir < 0 ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
}

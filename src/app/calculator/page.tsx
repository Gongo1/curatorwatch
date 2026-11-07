"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ChevronLeft, ExternalLink, Search } from "lucide-react";
import { calculateVaultEarnings, calculateAnnualEarnings } from "@/lib/utils/calculator";
import { formatCurrency } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";
import { getVaultDepositUrl, getDepositLabel } from "@/lib/utils/morpho";
import type { VaultData } from "@/lib/types/api";

const BLUE_CHIP_ASSETS = ["USDC", "USDT", "USDA", "DAI", "wstETH", "WETH", "WBTC", "EURC", "PYUSD"];

interface ProcessedVault {
  address: string;
  name: string;
  symbol: string;
  assetSymbol: string;
  curatorName: string | null;
  dataSource: string;
  turtleId: string | null;
  tvl: number;
  netAPR: number | null;
  avgNetApy: number | null;
  rate: number;
  isBlueChip: boolean;
}

function processVaults(vaults: VaultData[]): ProcessedVault[] {
  const processed: ProcessedVault[] = [];

  for (const v of vaults) {
    const isTurtle = v.dataSource === "turtle";
    const netAPR = v.netAPR ?? null;
    const avgNetApy = v.latestSnapshot?.avgNetApy ?? null;
    const hasRate = isTurtle
      ? (netAPR != null && netAPR > 0)
      : (avgNetApy != null && avgNetApy > 0);
    if (!hasRate) continue;

    const rate = isTurtle ? (netAPR ?? 0) : ((avgNetApy ?? 0) * 100);
    const tvl = v.latestSnapshot?.totalAssetsUsd ?? 0;
    const isBlueChip = BLUE_CHIP_ASSETS.includes(v.asset.symbol);

    processed.push({
      address: v.address,
      name: v.name,
      symbol: v.symbol,
      assetSymbol: v.asset.symbol,
      curatorName: v.curatorName ?? null,
      dataSource: v.dataSource,
      turtleId: v.turtleId ?? null,
      tvl,
      netAPR,
      avgNetApy,
      rate,
      isBlueChip,
    });
  }

  return processed;
}

function formatUSD(val: number): string {
  return val.toLocaleString("en-US");
}

function parseAmount(str: string): number {
  return Number(str.replace(/[^0-9.]/g, "")) || 0;
}

export default function CalculatorPage() {
  const [depositAmount, setDepositAmount] = useState(1_000_000);
  const [displayAmount, setDisplayAmount] = useState("1,000,000");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedCollateral, setSelectedCollateral] = useState<"blue-chip" | "all" | null>(null);
  const [selectedCurator, setSelectedCurator] = useState<string | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [minAPR, setMinAPR] = useState("");
  const [maxAPR, setMaxAPR] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState<ProcessedVault | null>(null);
  const [allVaults, setAllVaults] = useState<ProcessedVault[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch vault data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/vaults");
        const data = await res.json();
        if (data.success) {
          setAllVaults(processVaults(data.data));
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Unique curator names for dropdown
  const curatorNames = useMemo(() => {
    const names = new Set<string>();
    for (const v of allVaults) {
      if (v.curatorName) names.add(v.curatorName);
    }
    return Array.from(names).sort();
  }, [allVaults]);

  // Unique asset symbols for dropdown
  const assetSymbols = useMemo(() => {
    const symbols = new Set<string>();
    for (const v of allVaults) {
      symbols.add(v.assetSymbol);
    }
    return Array.from(symbols).sort();
  }, [allVaults]);

  // Unique protocols for dropdown
  const protocols = useMemo(() => {
    const protos = new Set<string>();
    for (const v of allVaults) {
      protos.add(v.dataSource);
    }
    return Array.from(protos).sort();
  }, [allVaults]);

  // Filtered vaults — only computed when user has searched
  const matchingVaults = useMemo(() => {
    if (!hasSearched) return [];

    let filtered = allVaults;

    if (selectedCollateral === "blue-chip") {
      filtered = filtered.filter((v) => v.isBlueChip);
    }
    // Advanced filters
    if (selectedCurator) {
      filtered = filtered.filter((v) => v.curatorName === selectedCurator);
    }
    if (selectedProtocol) {
      filtered = filtered.filter((v) => v.dataSource === selectedProtocol);
    }
    if (selectedAsset) {
      filtered = filtered.filter((v) => v.assetSymbol === selectedAsset);
    }
    const minVal = parseFloat(minAPR);
    if (!isNaN(minVal)) {
      filtered = filtered.filter((v) => v.rate >= minVal);
    }
    const maxVal = parseFloat(maxAPR);
    if (!isNaN(maxVal)) {
      filtered = filtered.filter((v) => v.rate <= maxVal);
    }

    return [...filtered].sort((a, b) => b.rate - a.rate);
  }, [allVaults, selectedCollateral, selectedCurator, selectedProtocol, selectedAsset, minAPR, maxAPR, hasSearched]);

  const canSearch = selectedCollateral !== null;
  const hasAdvancedFilters = selectedCurator !== null || selectedProtocol !== null || selectedAsset !== null || minAPR !== "" || maxAPR !== "";

  function handleSearch() {
    setHasSearched(true);
  }

  function resetAllFilters() {
    setSelectedCollateral(null);
    setSelectedCurator(null);
    setSelectedProtocol(null);
    setSelectedAsset(null);
    setMinAPR("");
    setMaxAPR("");
    setHasSearched(false);
    setAdvancedOpen(false);
  }

  function resetAdvancedFilters() {
    setSelectedCurator(null);
    setSelectedProtocol(null);
    setSelectedAsset(null);
    setMinAPR("");
    setMaxAPR("");
    // Re-trigger search with just base filters
    setHasSearched(true);
  }

  return (
    <>
      <PageHeader
        title="LP Return Calculator"
        description="Set a deposit and a collateral type, then see the matching vaults and their projected earnings."
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "LP Calculator" },
        ]}
      />

      {/* If viewing vault results, show that */}
      {selectedVault ? (
        <ResultsView
          vault={selectedVault}
          depositAmount={depositAmount}
          onBack={() => setSelectedVault(null)}
        />
      ) : (
        <div className="space-y-1.5">
          {/* ── Inputs ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
            {/* Deposit Amount */}
            <Panel title="Deposit amount" meta="USD" bodyClassName="p-3">
              <label htmlFor="calc-deposit" className="label block mb-1.5">
                Amount
              </label>
              <div className="relative mb-2.5">
                <span className="num absolute left-2.5 top-1/2 -translate-y-1/2 text-lg text-text-muted">$</span>
                <input
                  id="calc-deposit"
                  type="text"
                  inputMode="numeric"
                  value={isFocused ? displayAmount : formatUSD(depositAmount)}
                  onChange={(e) => setDisplayAmount(e.target.value)}
                  onFocus={() => {
                    setIsFocused(true);
                    setDisplayAmount(depositAmount.toString());
                  }}
                  onBlur={() => {
                    setIsFocused(false);
                    const parsed = parseAmount(displayAmount);
                    const clamped = Math.max(0, Math.min(parsed, 1_000_000_000));
                    setDepositAmount(clamped);
                    setDisplayAmount(formatUSD(clamped));
                  }}
                  className="field num h-10 pl-7 text-xl font-semibold"
                  placeholder="1,000,000"
                />
              </div>
              <div role="group" aria-label="Preset amounts" className="inline-flex flex-wrap border border-border-strong">
                {[100_000, 500_000, 1_000_000, 5_000_000, 10_000_000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={depositAmount === preset}
                    onClick={() => {
                      setDepositAmount(preset);
                      setDisplayAmount(formatUSD(preset));
                    }}
                    className={`${SEG_BTN} num normal-case ${
                      depositAmount === preset ? SEG_ON : SEG_OFF
                    }`}
                  >
                    ${preset >= 1_000_000 ? `${preset / 1_000_000}M` : `${preset / 1_000}K`}
                  </button>
                ))}
              </div>
            </Panel>

            {/* Collateral Type */}
            <Panel title="Collateral type" meta="required" bodyClassName="p-3">
              <div role="group" aria-label="Collateral type" className="grid grid-cols-2 border border-border-strong">
                {(
                  [
                    { key: "blue-chip", title: "Blue-chip only", sub: "USDC, USDT, wstETH, WBTC…" },
                    { key: "all", title: "All collateral", sub: "Include exotic assets" },
                  ] as const
                ).map((opt) => {
                  const on = selectedCollateral === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSelectedCollateral(on ? null : opt.key)}
                      className={`px-3 py-2.5 text-left border-r border-border-strong last:border-r-0 transition-colors ${
                        on ? "bg-accent-blue text-signal-ink" : "hover:bg-background-hover"
                      }`}
                    >
                      <span className={`block cond text-[0.85rem] font-bold uppercase tracking-[0.04em] ${on ? "" : "text-text-primary"}`}>
                        {opt.title}
                      </span>
                      <span className={`block text-xs mt-0.5 ${on ? "opacity-80" : "text-text-tertiary"}`}>{opt.sub}</span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          {/* ── Advanced Filters (Collapsible) ── */}
          <Panel
            title="Advanced filters"
            meta={hasAdvancedFilters ? <span className="text-accent-blue">active</span> : "protocol · asset · rate · curator"}
            action={
              <button
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                aria-expanded={advancedOpen}
                className="label hover:text-accent-blue transition-colors inline-flex items-center gap-1"
              >
                {advancedOpen ? "Hide" : "Show"}
                <span aria-hidden="true">{advancedOpen ? "▴" : "▾"}</span>
              </button>
            }
          >
            {advancedOpen && (
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Protocol */}
                  <div>
                    <label htmlFor="calc-protocol" className="label block mb-1.5">Protocol</label>
                    <select
                      id="calc-protocol"
                      value={selectedProtocol || ""}
                      onChange={(e) => { setSelectedProtocol(e.target.value || null); setHasSearched(false); }}
                      className="field text-sm"
                    >
                      <option value="">All Protocols</option>
                      {protocols.map((p) => (
                        <option key={p} value={p}>{p === "turtle" ? "Turtle" : p === "morpho" ? "Morpho" : p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Asset */}
                  <div>
                    <label htmlFor="calc-asset" className="label block mb-1.5">Asset</label>
                    <select
                      id="calc-asset"
                      value={selectedAsset || ""}
                      onChange={(e) => { setSelectedAsset(e.target.value || null); setHasSearched(false); }}
                      className="field text-sm"
                    >
                      <option value="">All Assets</option>
                      {assetSymbols.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Min APR */}
                  <div>
                    <label htmlFor="calc-min" className="label block mb-1.5">Min APR %</label>
                    <input
                      id="calc-min"
                      type="number"
                      step="0.1"
                      value={minAPR}
                      onChange={(e) => { setMinAPR(e.target.value); setHasSearched(false); }}
                      placeholder="e.g. 3"
                      className="field num text-sm"
                    />
                  </div>

                  {/* Max APR */}
                  <div>
                    <label htmlFor="calc-max" className="label block mb-1.5">Max APR %</label>
                    <input
                      id="calc-max"
                      type="number"
                      step="0.1"
                      value={maxAPR}
                      onChange={(e) => { setMaxAPR(e.target.value); setHasSearched(false); }}
                      placeholder="e.g. 20"
                      className="field num text-sm"
                    />
                  </div>
                </div>

                {/* Curator */}
                <div className="max-w-xs">
                  <label htmlFor="calc-curator" className="label block mb-1.5">Curator</label>
                  <select
                    id="calc-curator"
                    value={selectedCurator || ""}
                    onChange={(e) => { setSelectedCurator(e.target.value || null); setHasSearched(false); }}
                    className="field text-sm"
                  >
                    <option value="">All Curators</option>
                    {curatorNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </Panel>

          {/* ── Search Button ── */}
          <div className="flex items-center gap-3 flex-wrap py-1">
            <button
              type="button"
              onClick={handleSearch}
              disabled={!canSearch}
              className="btn btn-primary"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              Find matching vaults
            </button>
            {!canSearch && (
              <p className="text-xs text-text-tertiary">
                Select a collateral type to search.
              </p>
            )}
            {hasSearched && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs text-accent-blue hover:underline"
              >
                Reset all
              </button>
            )}
          </div>

          {/* ── Results ── */}
          {loading ? (
            <Panel title="Matching vaults" meta="loading">
              <div className="animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 h-9 border-b border-border-subtle last:border-0">
                    <div className="h-3 w-40 bg-background-elevated" />
                    <div className="h-3 w-16 bg-background-elevated ml-auto" />
                  </div>
                ))}
              </div>
            </Panel>
          ) : !hasSearched ? (
            /* Empty state — before search */
            <Panel title="Matching vaults" meta="no search yet" bodyClassName="px-3 py-6 text-center">
              <p className="text-sm text-text-secondary">
                Select a collateral type above, then select{" "}
                <span className="font-semibold text-accent-blue">Find matching vaults</span>.
              </p>
            </Panel>
          ) : matchingVaults.length === 0 ? (
            /* No results state */
            <Panel title="Matching vaults" meta="0 vaults" bodyClassName="px-3 py-6 text-center">
              <p className="text-sm text-text-primary">No vault matches these filters.</p>
              <p className="text-sm text-text-secondary mt-1 mb-3">
                Widen the rate range or remove an advanced filter.
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {hasAdvancedFilters && (
                  <button type="button" onClick={resetAdvancedFilters} className="btn btn-ghost">
                    Reset advanced filters
                  </button>
                )}
                <button type="button" onClick={resetAllFilters} className="btn btn-ghost">
                  Reset all filters
                </button>
              </div>
            </Panel>
          ) : (
            <Panel
              title="Matching vaults"
              meta={`${matchingVaults.length} vault${matchingVaults.length !== 1 ? "s" : ""} · by rate`}
            >
              {/* Top 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-3">
                {matchingVaults.slice(0, 3).map((vault, i) => (
                  <VaultCard
                    key={vault.address}
                    vault={vault}
                    depositAmount={depositAmount}
                    rank={i + 1}
                    onClick={() => setSelectedVault(vault)}
                  />
                ))}
              </div>

              {/* Remaining Vaults Table */}
              {matchingVaults.length > 3 && (
                <div className="relative overflow-x-auto border-t border-border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-background">
                      <tr className="h-7 border-b border-border">
                        <th scope="col" className="label text-left px-3">Vault</th>
                        <th scope="col" className="label text-left px-3 hidden md:table-cell">Curator</th>
                        <th scope="col" className="label text-left px-3">Asset</th>
                        <th scope="col" className="label text-right px-3">Rate</th>
                        <th scope="col" className="label text-right px-3 whitespace-nowrap">Year 1 earnings</th>
                        <th scope="col" className="label text-right px-3">TVL</th>
                        <th scope="col" className="px-3"><span className="sr-only">Action</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchingVaults.slice(3).map((vault) => {
                        const earnings = calculateAnnualEarnings(depositAmount, vault.dataSource, vault.netAPR, vault.avgNetApy);
                        return (
                          <tr key={vault.address} className="h-8 border-b border-border-subtle last:border-0 hover:bg-background-hover transition-colors">
                            <td className="px-3 py-1">
                              <div className="text-text-primary font-medium leading-tight">{vault.name}</div>
                              <div className="md:hidden text-xs text-text-tertiary leading-tight">{vault.curatorName || "Self-Curated"}</div>
                            </td>
                            <td className="px-3 py-1 hidden md:table-cell text-text-secondary">{vault.curatorName || "Self-Curated"}</td>
                            <td className="px-3 py-1">
                              <AssetTag vault={vault} />
                            </td>
                            <td className="px-3 py-1 num text-right text-text-primary">{vault.rate.toFixed(2)}%</td>
                            <td className="px-3 py-1 num text-right up">
                              ${earnings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                            </td>
                            <td className="px-3 py-1 num text-right text-text-secondary">{formatCurrency(vault.tvl)}</td>
                            <td className="px-3 py-1 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedVault(vault)}
                                className="btn btn-ghost h-6 px-2 text-[0.7rem]"
                              >
                                Calculate
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

// Segmented control (hairline group, active = amber fill) — copies CuratorIndex.
const SEG_BTN =
  "h-[1.625rem] px-2.5 cond text-[0.75rem] font-semibold uppercase tracking-[0.04em] border-r border-border-strong last:border-r-0 transition-colors";
const SEG_ON = "bg-accent-blue text-signal-ink";
const SEG_OFF = "text-text-secondary hover:text-text-primary hover:bg-background-hover";

function AssetTag({ vault }: { vault: ProcessedVault }) {
  return (
    <span
      className={`num inline-block text-[0.7rem] px-1.5 py-px border ${
        vault.isBlueChip
          ? "text-text-secondary border-border-strong"
          : "text-accent-yellow border-accent-yellow-muted"
      }`}
      title={vault.isBlueChip ? "Blue-chip collateral" : "Not on the blue-chip list"}
    >
      {vault.assetSymbol}
    </span>
  );
}

// ────────────────────────────────────────
// Vault Card (top 3)
// ────────────────────────────────────────
function VaultCard({
  vault,
  depositAmount,
  rank,
  onClick,
}: {
  vault: ProcessedVault;
  depositAmount: number;
  rank: number;
  onClick: () => void;
}) {
  const yearlyReturn = calculateAnnualEarnings(depositAmount, vault.dataSource, vault.netAPR, vault.avgNetApy);
  const yourPercentage = vault.tvl > 0 ? (depositAmount / vault.tvl) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="p-3 text-left w-full min-w-0 border-b sm:border-b-0 sm:border-r border-border last:border-0 hover:bg-background-hover transition-colors group"
    >
      <div className="flex items-start gap-2">
        <span className="num text-xs text-accent-blue pt-0.5">{String(rank).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-text-primary leading-tight truncate group-hover:text-accent-blue transition-colors">
            {vault.name}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-text-tertiary truncate">{vault.curatorName || "Self-Curated"}</span>
            <AssetTag vault={vault} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="num text-[1.45rem] font-semibold leading-none text-text-primary">{vault.rate.toFixed(2)}%</span>
        <span className="label">{vault.dataSource === "turtle" ? "Net APR" : "Net APY"}</span>
      </div>

      <div className="text-sm text-text-secondary mt-2">
        <span className="num">${formatUSD(depositAmount)}</span> earns{" "}
        <span className="num font-semibold up">${yearlyReturn.toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr</span>
      </div>

      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border-subtle text-xs">
        <span className="label">TVL</span>
        <span className="num text-text-secondary -ml-2">{formatCurrency(vault.tvl)}</span>
        {yourPercentage > 10 && (
          <span className="num text-accent-yellow ml-auto">{yourPercentage.toFixed(1)}% of vault</span>
        )}
      </div>
    </button>
  );
}

// ────────────────────────────────────────
// Results View (after clicking a vault)
// ────────────────────────────────────────
function ResultsView({
  vault,
  depositAmount,
  onBack,
}: {
  vault: ProcessedVault;
  depositAmount: number;
  onBack: () => void;
}) {
  const isTurtle = vault.dataSource === "turtle";
  const months = 12;

  const result = useMemo(
    () => calculateVaultEarnings(depositAmount, months, vault.dataSource, vault.netAPR, vault.avgNetApy),
    [depositAmount, vault.dataSource, vault.netAPR, vault.avgNetApy],
  );

  // Chart data includes month 0
  const chartData = useMemo(() => {
    const data = [{ month: 0, principal: depositAmount, earnings: 0 }];
    for (const d of result.chartData) {
      data.push({ month: d.month, principal: d.principal, earnings: d.earnings });
    }
    return data;
  }, [result, depositAmount]);

  const sharePct = vault.tvl > 0 ? (depositAmount / vault.tvl) * 100 : 0;
  const usd0 = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const usd2 = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-1.5">
      {/* Back button */}
      <button type="button" onClick={onBack} className="btn btn-ghost">
        <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
        Back to vault list
      </button>

      {/* Header */}
      <section className="panel" aria-label="Selected vault">
        <div className="flex items-center justify-between flex-wrap gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <h2 className="cond text-[1.2rem] font-bold leading-tight text-text-primary">{vault.name}</h2>
            <p className="text-sm text-text-secondary mt-0.5">
              <span className="num">{vault.assetSymbol}</span> · {vault.curatorName || "Self-Curated"} · Returns for a{" "}
              <span className="num">${formatUSD(depositAmount)}</span> deposit
            </p>
          </div>
          <Link href={`/vault/${vault.address}`} className="btn btn-ghost">
            View vault details
          </Link>
        </div>

        {/* Key Metrics */}
        <dl className="grid grid-cols-2 lg:grid-cols-4 border-t border-border">
          <Metric
            k="First payment"
            v={usd2(result.firstMonthEarnings)}
            sub={isTurtle ? "Day 30 (monthly)" : "Day 1 (compounds every block)"}
            lead
          />
          <Metric
            k="Month 1 earnings"
            v={usd2(result.firstMonthEarnings)}
            sub={`${((result.firstMonthEarnings / depositAmount) * 100).toFixed(3)}% return`}
          />
          <Metric
            k="Year 1 total"
            v={usd2(result.yearOneTotal)}
            sub={`${vault.rate.toFixed(2)}% net return`}
          />
          <Metric k={isTurtle ? "Net APR" : "Net APY"} v={`${vault.rate.toFixed(2)}%`} />
        </dl>
      </section>

      {/* Liquidity Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <Panel title="Withdrawal terms">
          <dl className="text-sm">
            <Row k="Lock period" v={<span className="text-text-primary">None</span>} />
            <Row k="Withdraw anytime" v={<span className="up">Yes</span>} />
          </dl>
        </Panel>

        <Panel title="Liquidity check">
          <dl className="text-sm">
            <Row k="Current TVL" v={<span className="num text-text-primary">{formatCurrency(vault.tvl)}</span>} />
            <Row
              k="Your % of vault"
              v={
                <span className={`num ${sharePct > 10 ? "text-accent-yellow" : "up"}`}>
                  {sharePct.toFixed(1)}%
                </span>
              }
            />
          </dl>
          {vault.tvl > 0 && sharePct > 10 && (
            <p className="px-3 py-2 border-t border-border-subtle text-xs text-accent-yellow">
              Your deposit is more than 10% of the vault TVL. A large withdrawal can see slippage.
            </p>
          )}
        </Panel>
      </div>

      {/* Cumulative Earnings Chart */}
      <Panel title="Growth" meta={`$${formatUSD(depositAmount)} · 12 months`} bodyClassName="p-3">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
              <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tickFormatter={(v) => `M${v}`}
              />
              <YAxis
                tick={{ fill: "var(--text-tertiary)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v) => {
                  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
                  return `$${v}`;
                }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="principal"
                stackId="1"
                stroke="var(--chart-3)"
                fill="var(--chart-3)"
                fillOpacity={0.12}
                strokeWidth={1}
                name="Principal"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="earnings"
                stackId="1"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.45}
                strokeWidth={1.25}
                name="Earnings"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 flex-wrap mt-2">
          {[
            { name: "Principal", color: "var(--chart-3)" },
            { name: "Earnings", color: "var(--chart-1)" },
          ].map((s) => (
            <span key={s.name} className="label normal-case tracking-normal font-normal text-text-secondary inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-[3px]" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
        <div className="mt-3 pt-2.5 border-t border-border-subtle text-sm text-text-secondary">
          <span className="label mr-2">After 12 months</span>
          Your <span className="num">${formatUSD(depositAmount)}</span> grows to{" "}
          <span className="num font-semibold up">{usd0(depositAmount + result.yearOneTotal)}</span>
          {isTurtle && <span>. Paid monthly.</span>}
        </div>
      </Panel>

      {/* Payment Schedule */}
      <Panel title="Payment schedule" meta="12 months">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-background">
              <tr className="h-7 border-b border-border">
                <th scope="col" className="label text-left px-3">Month</th>
                <th scope="col" className="label text-right px-3">Payment</th>
                <th scope="col" className="label text-right px-3">Cumulative</th>
                <th scope="col" className="label text-right px-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {result.schedule.map((row) => (
                <tr key={row.month} className="h-8 border-b border-border-subtle hover:bg-background-hover transition-colors">
                  <td className="px-3 text-text-primary">Month <span className="num">{row.month}</span></td>
                  <td className="px-3 num text-right up">{usd0(row.payment)}</td>
                  <td className="px-3 num text-right text-text-secondary">{usd0(row.cumulative)}</td>
                  <td className="px-3 num text-right text-text-primary">{usd0(row.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-background-elevated border-t border-border">
              <tr className="h-9 font-semibold">
                <td className="px-3 text-text-primary whitespace-nowrap">Total year 1</td>
                <td className="px-3 num text-right text-text-muted">-</td>
                <td className="px-3 num text-right up">{usd0(result.yearOneTotal)}</td>
                <td className="px-3 num text-right text-text-primary">{usd0(depositAmount + result.yearOneTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <button type="button" onClick={onBack} className="btn btn-ghost w-full">
          Try a different vault
        </button>
        <a
          href={getVaultDepositUrl(vault.address, vault.name, vault.dataSource, vault.turtleId)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost w-full"
        >
          {getDepositLabel(vault.dataSource)}
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>

      <p className="text-xs text-text-muted text-center">
        Projections use the current rates. Actual returns can differ.
      </p>
    </div>
  );
}

function Metric({ k, v, sub, lead = false }: { k: string; v: string; sub?: string; lead?: boolean }) {
  return (
    <div className="px-3 py-2.5 border-border border-r border-b lg:border-b-0 min-w-0">
      <dt className="label">{k}</dt>
      <dd className={`num font-semibold text-[1.35rem] leading-none mt-1.5 truncate ${lead ? "text-accent-blue" : "text-text-primary"}`}>
        {v}
      </dd>
      {sub && <dd className="text-xs text-text-tertiary mt-1">{sub}</dd>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between h-8 px-3 border-b border-border-subtle last:border-0">
      <dt className="text-text-secondary">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

// Chart tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className="bg-background-elevated border border-border-strong px-2.5 py-2 num text-xs">
      <p className="text-text-tertiary mb-1">Month {label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2" style={{ backgroundColor: item.color }} />
            <span className="text-text-secondary">{item.name}</span>
          </span>
          <span className="text-text-primary">
            ${item.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
      <div className="border-t border-border mt-1.5 pt-1.5 flex justify-between">
        <span className="text-text-secondary">Total</span>
        <span className="font-semibold text-text-primary">
          ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}

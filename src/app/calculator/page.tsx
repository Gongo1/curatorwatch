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
  Legend,
  CartesianGrid,
} from "recharts";
import { calculateVaultEarnings, calculateAnnualEarnings } from "@/lib/utils/calculator";
import { formatCurrency } from "@/lib/utils/format";
import { VaultGradeBadge } from "@/components/VaultGradeBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { AuthGate } from "@/components/AuthGate";
import { getVaultDepositUrl, getDepositLabel } from "@/lib/utils/morpho";
import { useUser } from "@clerk/nextjs";
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
  grade: "high-grade" | "medium-grade" | "low-grade";
  gradeFailures: string[];
  riskScore: number | null;
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
      grade: (v.grade === "high-grade" ? "high-grade" : v.grade === "medium-grade" ? "medium-grade" : "low-grade") as ProcessedVault["grade"],
      gradeFailures: v.gradeFailures ?? [],
      riskScore: v.riskScore ?? null,
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
  const { user } = useUser();
  const [depositAmount, setDepositAmount] = useState(1_000_000);
  const [displayAmount, setDisplayAmount] = useState("1,000,000");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<"high-grade" | "medium-grade" | "low-grade" | null>(null);
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

    if (selectedGrade) {
      filtered = filtered.filter((v) => v.grade === selectedGrade);
    }
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
  }, [allVaults, selectedGrade, selectedCollateral, selectedCurator, selectedProtocol, selectedAsset, minAPR, maxAPR, hasSearched]);

  const canSearch = selectedGrade !== null && selectedCollateral !== null;
  const hasAdvancedFilters = selectedCurator !== null || selectedProtocol !== null || selectedAsset !== null || minAPR !== "" || maxAPR !== "";

  function handleSearch() {
    setHasSearched(true);
  }

  function resetAllFilters() {
    setSelectedGrade(null);
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
        description="Configure your preferences and see matching vaults instantly"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "LP Calculator" },
        ]}
      />

      {/* If viewing vault results, show that */}
      {selectedVault ? (
        <AuthGate message="Sign in to see your results">
          <ResultsView
            vault={selectedVault}
            depositAmount={depositAmount}
            onBack={() => setSelectedVault(null)}
          />
        </AuthGate>
      ) : (
        <>
          {/* ── Filter Row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Column 1: Deposit Amount */}
            <div className="bg-background-subtle rounded-xl border border-border p-5">
              <label className="text-xs font-medium text-text-secondary mb-2 block">
                Deposit Amount
              </label>
              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-text-muted">$</span>
                <input
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
                  className="w-full pl-9 pr-4 py-3 text-2xl font-bold bg-background-elevated border-2 border-border rounded-lg text-text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue"
                  placeholder="1,000,000"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[100_000, 500_000, 1_000_000, 5_000_000, 10_000_000].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setDepositAmount(preset);
                      setDisplayAmount(formatUSD(preset));
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      depositAmount === preset
                        ? "bg-accent-blue text-white"
                        : "bg-background-elevated text-text-muted hover:text-text-primary border border-border"
                    }`}
                  >
                    ${preset >= 1_000_000 ? `${preset / 1_000_000}M` : `${preset / 1_000}K`}
                  </button>
                ))}
              </div>
            </div>

            {/* Column 2: Vault Grade */}
            <div className="bg-background-subtle rounded-xl border border-border p-5">
              <label className="text-xs font-medium text-text-secondary mb-2 block">
                Vault Grade
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedGrade(selectedGrade === "high-grade" ? null : "high-grade")}
                  className={`w-full p-3 border-2 rounded-lg text-left transition ${
                    selectedGrade === "high-grade"
                      ? "border-accent-green bg-accent-green/5"
                      : "border-border bg-background-elevated hover:border-accent-green/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <svg className="w-4 h-4 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="font-semibold text-sm text-text-primary">High Grade</span>
                  </div>
                  <p className="text-[11px] text-text-tertiary ml-6">Passes all 9 quality requirements</p>
                </button>

                <button
                  onClick={() => setSelectedGrade(selectedGrade === "medium-grade" ? null : "medium-grade")}
                  className={`w-full p-3 border-2 rounded-lg text-left transition ${
                    selectedGrade === "medium-grade"
                      ? "border-accent-yellow bg-accent-yellow/5"
                      : "border-border bg-background-elevated hover:border-accent-yellow/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <svg className="w-4 h-4 text-accent-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-semibold text-sm text-text-primary">Medium Grade</span>
                  </div>
                  <p className="text-[11px] text-text-tertiary ml-6">Fails 1-3 requirements</p>
                </button>

                <button
                  onClick={() => setSelectedGrade(selectedGrade === "low-grade" ? null : "low-grade")}
                  className={`w-full p-3 border-2 rounded-lg text-left transition ${
                    selectedGrade === "low-grade"
                      ? "border-accent-red bg-accent-red/5"
                      : "border-border bg-background-elevated hover:border-accent-red/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <svg className="w-4 h-4 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="font-semibold text-sm text-text-primary">Low Grade</span>
                  </div>
                  <p className="text-[11px] text-text-tertiary ml-6">Fails 4+ requirements</p>
                </button>
              </div>
            </div>

            {/* Column 3: Collateral Type */}
            <div className="bg-background-subtle rounded-xl border border-border p-5">
              <label className="text-xs font-medium text-text-secondary mb-2 block">
                Collateral Type
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedCollateral(selectedCollateral === "blue-chip" ? null : "blue-chip")}
                  className={`w-full p-3 border-2 rounded-lg text-left transition ${
                    selectedCollateral === "blue-chip"
                      ? "border-accent-blue bg-accent-blue/5"
                      : "border-border bg-background-elevated hover:border-accent-blue/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <svg className="w-4 h-4 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span className="font-semibold text-sm text-text-primary">Blue-Chip Only</span>
                  </div>
                  <p className="text-[11px] text-text-tertiary ml-6">USDC, USDT, wstETH, WBTC...</p>
                </button>

                <button
                  onClick={() => setSelectedCollateral(selectedCollateral === "all" ? null : "all")}
                  className={`w-full p-3 border-2 rounded-lg text-left transition ${
                    selectedCollateral === "all"
                      ? "border-accent-purple bg-accent-purple/5"
                      : "border-border bg-background-elevated hover:border-accent-purple/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <svg className="w-4 h-4 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-sm text-text-primary">All Collateral</span>
                  </div>
                  <p className="text-[11px] text-text-tertiary ml-6">Include exotic assets</p>
                </button>
              </div>
            </div>
          </div>

          {/* ── Advanced Filters (Collapsible) ── */}
          <div className="bg-background-subtle rounded-xl border border-border mb-6">
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Advanced Filters
                {hasAdvancedFilters && (
                  <span className="px-1.5 py-0.5 bg-accent-blue/10 text-accent-blue text-[10px] rounded font-medium">
                    Active
                  </span>
                )}
              </span>
              <svg className={`w-4 h-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {advancedOpen && (
              <div className="px-5 pb-4 pt-1 border-t border-border">
                <AuthGate message="Sign in to use advanced filters">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Protocol */}
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">Protocol</label>
                    <select
                      value={selectedProtocol || ""}
                      onChange={(e) => { setSelectedProtocol(e.target.value || null); setHasSearched(false); }}
                      className="w-full px-3 py-2 text-sm bg-background-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                    >
                      <option value="">All Protocols</option>
                      {protocols.map((p) => (
                        <option key={p} value={p}>{p === "turtle" ? "Turtle" : p === "morpho" ? "Morpho" : p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Asset */}
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">Asset</label>
                    <select
                      value={selectedAsset || ""}
                      onChange={(e) => { setSelectedAsset(e.target.value || null); setHasSearched(false); }}
                      className="w-full px-3 py-2 text-sm bg-background-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                    >
                      <option value="">All Assets</option>
                      {assetSymbols.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Min APR */}
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">Min APR %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={minAPR}
                      onChange={(e) => { setMinAPR(e.target.value); setHasSearched(false); }}
                      placeholder="e.g. 3"
                      className="w-full px-3 py-2 text-sm bg-background-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                    />
                  </div>

                  {/* Max APR */}
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-1.5 block">Max APR %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={maxAPR}
                      onChange={(e) => { setMaxAPR(e.target.value); setHasSearched(false); }}
                      placeholder="e.g. 20"
                      className="w-full px-3 py-2 text-sm bg-background-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                    />
                  </div>
                </div>

                {/* Curator */}
                <div className="mt-4">
                  <label className="text-xs font-medium text-text-secondary mb-1.5 block">Curator</label>
                  <select
                    value={selectedCurator || ""}
                    onChange={(e) => { setSelectedCurator(e.target.value || null); setHasSearched(false); }}
                    className="w-full max-w-xs px-3 py-2 text-sm bg-background-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue/50"
                  >
                    <option value="">All Curators</option>
                    {curatorNames.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                </AuthGate>
              </div>
            )}
          </div>

          {/* ── Search Button ── */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={handleSearch}
              disabled={!canSearch}
              className={`px-6 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
                canSearch
                  ? "bg-accent-blue text-white hover:bg-accent-blue-hover"
                  : "bg-background-elevated text-text-muted cursor-not-allowed border border-border"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Find Matching Vaults
            </button>
            {!canSearch && (
              <p className="text-xs text-text-muted">
                Select a vault grade and collateral type to search
              </p>
            )}
            {hasSearched && (
              <button
                onClick={resetAllFilters}
                className="text-xs text-accent-blue hover:text-accent-blue-hover font-medium"
              >
                Reset all
              </button>
            )}
          </div>

          {/* ── Results ── */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-background-subtle rounded-xl border border-border p-6 animate-pulse">
                  <div className="h-5 w-40 bg-background-elevated rounded mb-3" />
                  <div className="h-4 w-24 bg-background-elevated rounded" />
                </div>
              ))}
            </div>
          ) : !hasSearched ? (
            /* Empty state — before search */
            <div className="bg-background-subtle rounded-xl border border-border p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-text-primary mb-2">Ready to find your perfect vault?</h3>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Select your vault grade and collateral type above, then click <span className="font-semibold text-accent-blue">Find Matching Vaults</span> to see personalized results.
              </p>
            </div>
          ) : matchingVaults.length === 0 ? (
            /* No results state */
            <div className="bg-background-subtle rounded-xl border border-border p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-text-primary mb-2">No vaults match your criteria</h3>
              <p className="text-sm text-text-secondary mb-4">
                Try adjusting your filters or removing advanced filter constraints.
              </p>
              <div className="flex items-center justify-center gap-3">
                {hasAdvancedFilters && (
                  <button
                    onClick={resetAdvancedFilters}
                    className="px-4 py-2 text-sm font-medium text-accent-blue border border-accent-blue/20 rounded-lg hover:bg-accent-blue/5 transition-colors"
                  >
                    Reset Advanced Filters
                  </button>
                )}
                <button
                  onClick={resetAllFilters}
                  className="px-4 py-2 text-sm font-medium text-text-secondary border border-border rounded-lg hover:bg-background-hover transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Match count */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-text-secondary">
                  <span className="font-semibold text-text-primary">{matchingVaults.length}</span> vault{matchingVaults.length !== 1 ? "s" : ""} match your criteria
                </p>
              </div>

              {/* Top 3 Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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
                <div className="bg-background-subtle rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-background-elevated border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Vault</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Asset</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Rate</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Year 1 Earnings</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">TVL</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {matchingVaults.slice(3).map((vault) => {
                          const earnings = calculateAnnualEarnings(depositAmount, vault.dataSource, vault.netAPR, vault.avgNetApy);
                          return (
                            <tr key={vault.address} className="hover:bg-background-hover transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium text-text-primary">{vault.name}</span>
                                  <VaultGradeBadge grade={vault.grade} failures={vault.gradeFailures} />
                                </div>
                                <span className="text-xs text-text-tertiary">{vault.curatorName || "Self-Curated"}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                  vault.isBlueChip
                                    ? "bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                                    : "bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20"
                                }`}>
                                  {vault.assetSymbol}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-semibold text-accent-green tabular-nums">{vault.rate.toFixed(2)}%</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm font-medium text-text-primary tabular-nums">
                                  ${earnings.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className="text-sm text-text-secondary tabular-nums">{formatCurrency(vault.tvl)}</span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setSelectedVault(vault)}
                                  className="px-3 py-1.5 bg-accent-blue text-white rounded-lg text-xs font-medium hover:bg-accent-blue-hover transition-colors"
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
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
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

  const rankColors = [
    "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20",
    "bg-text-muted/10 text-text-muted border-text-muted/20",
    "bg-amber-700/10 text-amber-600 border-amber-700/20",
  ];

  return (
    <button
      onClick={onClick}
      className="bg-background-subtle p-5 rounded-xl border-2 border-border hover:border-accent-blue text-left w-full transition-colors group"
    >
      {/* Rank + badges */}
      <div className="flex items-center justify-between mb-3">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${rankColors[rank - 1] || rankColors[2]}`}>
          {rank}
        </span>
        <div className="flex items-center gap-1.5">
          {vault.grade === "high-grade" && (
            <span className="px-2 py-0.5 bg-accent-green/10 text-accent-green text-[10px] rounded font-medium border border-accent-green/20">
              High Grade
            </span>
          )}
          {vault.grade === "medium-grade" && (
            <span className="px-2 py-0.5 bg-accent-yellow/10 text-accent-yellow text-[10px] rounded font-medium border border-accent-yellow/20">
              Medium Grade
            </span>
          )}
          {vault.riskScore != null && (
            <span className="px-2 py-0.5 bg-background-elevated text-text-muted text-[10px] rounded font-medium border border-border">
              Score: {vault.riskScore}/100
            </span>
          )}
          <VaultGradeBadge grade={vault.grade} failures={vault.gradeFailures} />
        </div>
      </div>

      {/* Vault Info */}
      <div className="font-bold text-text-primary mb-0.5 group-hover:text-accent-blue transition-colors">{vault.name}</div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-xs text-text-tertiary">{vault.curatorName || "Self-Curated"}</span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
          vault.isBlueChip
            ? "bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
            : "bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20"
        }`}>
          {vault.assetSymbol}
        </span>
      </div>

      {/* Rate */}
      <div className="mb-3">
        <div className="text-2xl font-bold text-accent-green tabular-nums">{vault.rate.toFixed(2)}%</div>
        <div className="text-[11px] text-text-muted">{vault.dataSource === "turtle" ? "Net APR" : "Net APY"}</div>
      </div>

      {/* Returns */}
      <div className="text-sm text-text-secondary mb-3">
        ${formatUSD(depositAmount)} earns{" "}
        <span className="font-bold text-accent-green">${yearlyReturn.toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr</span>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs text-text-muted border-t border-border pt-3">
        <span>TVL: {formatCurrency(vault.tvl)}</span>
        {yourPercentage > 10 && (
          <span className="text-accent-yellow">{yourPercentage.toFixed(1)}% of vault</span>
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

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to vault list
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-accent-green/20 to-accent-green/5 p-6 rounded-xl border border-accent-green/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-1">{vault.name}</h2>
            <p className="text-sm text-text-secondary">
              {vault.assetSymbol} — {vault.curatorName || "Self-Curated"} — Returns for ${formatUSD(depositAmount)} deposit
            </p>
          </div>
          <Link
            href={`/vault/${vault.address}`}
            className="px-4 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue-hover transition-colors"
          >
            View Vault Details
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border-2 border-accent-green/30 bg-accent-green/5 p-4">
          <p className="text-xs text-text-secondary mb-0.5">First Payment</p>
          <p className="text-2xl font-bold text-accent-green tabular-nums">
            ${result.firstMonthEarnings.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {isTurtle ? "Day 30 (monthly)" : "Day 1 (compounds every block)"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background-subtle p-4">
          <p className="text-xs text-text-secondary mb-0.5">Month 1 Earnings</p>
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            ${result.firstMonthEarnings.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {((result.firstMonthEarnings / depositAmount) * 100).toFixed(3)}% return
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background-subtle p-4">
          <p className="text-xs text-text-secondary mb-0.5">Year 1 Total</p>
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            ${result.yearOneTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-accent-green mt-1">{vault.rate.toFixed(2)}% net return</p>
        </div>

        <div className="rounded-xl border border-border bg-background-subtle p-4">
          <p className="text-xs text-text-secondary mb-0.5">{isTurtle ? "Net APR" : "Net APY"}</p>
          <p className="text-2xl font-bold text-accent-blue tabular-nums">{vault.rate.toFixed(2)}%</p>
        </div>
      </div>

      {/* Liquidity Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-background-subtle rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
            Withdrawal Terms
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Lock period:</span>
              <span className="font-medium text-text-primary">None</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Withdraw anytime:</span>
              <span className="font-medium text-accent-green">Yes</span>
            </div>
          </div>
        </div>

        <div className="bg-background-subtle rounded-xl border border-border p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Liquidity Check
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">Current TVL:</span>
              <span className="font-medium text-text-primary">{formatCurrency(vault.tvl)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Your % of vault:</span>
              {(() => {
                const pct = vault.tvl > 0 ? (depositAmount / vault.tvl) * 100 : 0;
                return (
                  <span className={`font-medium ${pct > 10 ? "text-accent-yellow" : "text-accent-green"}`}>
                    {pct.toFixed(1)}%
                  </span>
                );
              })()}
            </div>
          </div>
          {vault.tvl > 0 && (depositAmount / vault.tvl) * 100 > 10 && (
            <p className="mt-3 pt-3 border-t border-border text-xs text-accent-yellow">
              Your deposit is {">"}10% of vault TVL. May experience slippage on large withdrawals.
            </p>
          )}
        </div>
      </div>

      {/* Cumulative Earnings Chart */}
      <div className="bg-background-subtle rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">
          Growth of ${formatUSD(depositAmount)} over 12 months
        </h3>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="calcGradEarnings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="calcGradPrincipal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6B7280" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6B7280" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} tickFormatter={(v) => `M${v}`} />
              <YAxis
                tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} width={65}
                tickFormatter={(v) => {
                  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
                  return `$${v}`;
                }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#9CA3AF" }} />
              <Area type="monotone" dataKey="principal" stackId="1" stroke="#6B7280" fill="url(#calcGradPrincipal)" strokeWidth={1} name="Principal" />
              <Area type="monotone" dataKey="earnings" stackId="1" stroke="#10B981" fill="url(#calcGradEarnings)" strokeWidth={1.5} name="Earnings" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 rounded-lg bg-accent-green/5 border border-accent-green/20 p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-accent-green flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-text-primary">After 12 months:</p>
            <p className="text-sm text-text-secondary">
              Your ${formatUSD(depositAmount)} grows to{" "}
              <span className="font-bold text-accent-green">
                ${(depositAmount + result.yearOneTotal).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
              {isTurtle && <span> — Paid monthly</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Schedule */}
      <div className="bg-background-subtle rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Payment Schedule</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-background-elevated border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Month</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Payment</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Cumulative</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {result.schedule.map((row) => (
                <tr key={row.month} className="hover:bg-background-hover transition-colors">
                  <td className="px-4 py-2.5 text-sm text-text-primary tabular-nums">Month {row.month}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-accent-green tabular-nums">
                    ${row.payment.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right text-text-secondary tabular-nums">
                    ${row.cumulative.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right font-medium text-text-primary tabular-nums">
                    ${row.balance.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-background-elevated border-t border-border font-semibold">
              <tr>
                <td className="px-4 py-3 text-sm text-text-primary">Total Year 1</td>
                <td className="px-4 py-3 text-sm text-right text-text-muted">-</td>
                <td className="px-4 py-3 text-sm text-right text-accent-green tabular-nums">
                  ${result.yearOneTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
                <td className="px-4 py-3 text-sm text-right text-text-primary tabular-nums">
                  ${(depositAmount + result.yearOneTotal).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 py-4 border-2 border-border rounded-xl font-semibold text-text-primary hover:bg-background-hover transition-colors"
        >
          Try Different Vault
        </button>
        <a
          href={getVaultDepositUrl(vault.address, vault.name, vault.dataSource, vault.turtleId)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-4 bg-accent-green text-white rounded-xl font-semibold hover:bg-accent-green/90 transition-colors text-center"
        >
          {getDepositLabel(vault.dataSource)}
        </a>
      </div>

      <p className="text-[11px] text-text-muted text-center">
        Projections based on current rates. Actual returns may vary.
      </p>
    </div>
  );
}

// Chart tooltip
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className="bg-background-elevated border border-border rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs text-text-secondary mb-1">Month {label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-text-secondary">{item.name}</span>
          </span>
          <span className="font-medium text-text-primary tabular-nums">
            ${item.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
      <div className="border-t border-border mt-1.5 pt-1.5 flex justify-between text-xs">
        <span className="text-text-secondary">Total</span>
        <span className="font-semibold text-text-primary tabular-nums">
          ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}

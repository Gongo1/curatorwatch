"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";

interface FeaturedVault {
  address: string;
  name: string;
  symbol: string;
  assetSymbol: string;
  curatorName: string | null;
  dataSource: string;
  riskScore: number;
  tvl: number;
  rate: number;
}

const CURATOR_REASONS: Record<string, string> = {
  "Steakhouse Financial": "Institutional-grade risk management, 2+ years track record",
  "Gauntlet": "Data-driven strategy, battle-tested protocols",
  "Re7 Labs": "Quantitative approach, consistent performance",
  "Block Analitica": "Advanced analytics, rigorous market monitoring",
  "MEV Capital": "MEV-aware strategies, optimized execution",
  "ClearStar Labs AG": "Systematic yield optimization, institutional compliance",
};

function getCuratedReason(curatorName: string | null): string {
  if (curatorName && CURATOR_REASONS[curatorName]) {
    return CURATOR_REASONS[curatorName];
  }
  return "Top-tier vault with strong fundamentals";
}

function formatTvl(tvl: number): string {
  if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(1)}B`;
  if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(0)}M`;
  if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(0)}K`;
  return `$${tvl.toFixed(0)}`;
}

export function VaultsOfTheWeek() {
  const [featured, setFeatured] = useState<FeaturedVault[]>([]);
  const [more, setMore] = useState<FeaturedVault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/vaults/featured");
        const data = await res.json();
        if (!data.success) return;
        setFeatured(data.data.featured);
        setMore(data.data.more);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="mb-5">
        <div className="h-5 w-48 bg-background-elevated rounded animate-pulse mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-background-subtle border border-border rounded-xl p-5 animate-pulse">
              <div className="h-4 w-20 bg-background-elevated rounded mb-3" />
              <div className="h-6 w-32 bg-background-elevated rounded mb-2" />
              <div className="h-4 w-24 bg-background-elevated rounded mb-4" />
              <div className="h-8 w-20 bg-background-elevated rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (featured.length === 0) return null;

  return (
    <div className="mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-text-primary">Vaults of the Week</h3>
        <Link
          href="/calculator"
          className="flex items-center gap-1.5 text-xs font-medium text-accent-blue hover:text-accent-blue-hover transition-colors"
        >
          Open LP Calculator
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
      <p className="text-xs text-text-tertiary mb-3">
        High-grade vaults with blue-chip collateral and established curators
      </p>

      {/* Featured Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {featured.map((vault) => (
          <Link
            key={vault.address}
            href={`/vault/${vault.address}`}
            className="bg-background-subtle border border-border rounded-xl p-5 hover:border-accent-blue transition-colors group"
          >
            {/* Badges */}
            <div className="flex items-center gap-1.5 mb-3">
              <span className="px-2 py-0.5 bg-accent-green/10 text-accent-green text-[10px] rounded font-medium border border-accent-green/20">
                High Grade
              </span>
              <span className="px-2 py-0.5 bg-accent-blue/10 text-accent-blue text-[10px] rounded font-medium border border-accent-blue/20">
                {formatTvl(vault.tvl)} TVL
              </span>
            </div>

            {/* Vault name */}
            <div className="mb-0.5">
              <span className="text-sm font-bold text-text-primary group-hover:text-accent-blue transition-colors truncate">
                {vault.name}
              </span>
            </div>

            {/* Curator + asset */}
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-xs text-text-tertiary">{vault.curatorName}</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                {vault.assetSymbol}
              </span>
            </div>

            {/* Rate */}
            <div className="text-2xl font-bold text-accent-green tabular-nums mb-1">
              {vault.rate.toFixed(2)}%
            </div>
            <div className="text-xs text-text-muted mb-3">
              {vault.dataSource === "turtle" ? "Net APR" : "Net APY"}
            </div>

            {/* Footer */}
            <div className="border-t border-border pt-3">
              <p className="text-[11px] text-text-muted">
                {getCuratedReason(vault.curatorName)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* More High Grade Vaults */}
      {more.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-text-secondary mb-2">More High Grade Vaults</h4>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {more.map((vault) => (
              <Link
                key={vault.address}
                href={`/vault/${vault.address}`}
                className="w-56 flex-shrink-0 bg-background-subtle border border-border rounded-lg p-3 hover:border-accent-blue transition-colors group"
              >
                <div className="text-xs font-semibold text-text-primary group-hover:text-accent-blue transition-colors truncate mb-1">
                  {vault.name}
                </div>
                <div className="text-[11px] text-text-tertiary truncate mb-2">
                  {vault.curatorName}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-accent-green tabular-nums">
                    {vault.rate.toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {formatTvl(vault.tvl)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { VaultGradeBadge } from "./VaultGradeBadge";

const BLUE_CHIP_ASSETS = ["USDC", "USDT", "USDA", "DAI", "wstETH", "WETH", "WBTC", "EURC", "PYUSD"];

interface FavoriteVault {
  address: string;
  name: string;
  symbol: string;
  assetSymbol: string;
  curatorName: string | null;
  dataSource: string;
  grade?: string | null;
  gradeFailures?: string[];
  tvl: number;
  rate: number;
  curatedReason: string;
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

export function VaultFinder() {
  const [favorites, setFavorites] = useState<FavoriteVault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/vaults");
        const data = await res.json();
        if (!data.success) return;

        // Process vaults
        interface VaultEntry {
          address: string;
          name: string;
          symbol: string;
          assetSymbol: string;
          curatorName: string | null;
          dataSource: string;
          tvl: number;
          rate: number;
          isBlueChip: boolean;
          grade: string | null;
          gradeFailures: string[];
        }

        const entries: VaultEntry[] = [];

        for (const v of data.data) {
          const isTurtle = v.dataSource === "turtle";
          const netAPR = v.netAPR ?? null;
          const avgNetApy = v.latestSnapshot?.avgNetApy ?? null;
          const hasRate = isTurtle
            ? (netAPR != null && netAPR > 0)
            : (avgNetApy != null && avgNetApy > 0);
          if (!hasRate) continue;

          const tvl = v.latestSnapshot?.totalAssetsUsd ?? 0;
          const rate = isTurtle ? (netAPR ?? 0) : ((avgNetApy ?? 0) * 100);
          const isBlueChip = BLUE_CHIP_ASSETS.includes(v.asset?.symbol ?? "");

          entries.push({
            address: v.address,
            name: v.name,
            symbol: v.symbol,
            assetSymbol: v.asset?.symbol ?? "",
            curatorName: v.curatorName ?? null,
            dataSource: v.dataSource,
            tvl,
            rate,
            isBlueChip,
            grade: v.grade ?? null,
            gradeFailures: v.gradeFailures ?? [],
          });
        }

        // Filter: high-grade (from DB) + blue-chip + has curator, then sort by rate
        const curated = entries
          .filter((v) => v.grade === "high-grade" && v.isBlueChip && v.curatorName)
          .sort((a, b) => b.rate - a.rate)
          .slice(0, 3)
          .map((v) => ({
            ...v,
            curatedReason: getCuratedReason(v.curatorName),
          }));

        // Fallback: if fewer than 3 curated, fill with top high-grade by rate
        if (curated.length < 3) {
          const remaining = entries
            .filter((v) => v.grade === "high-grade" && !curated.some((c) => c.address === v.address))
            .sort((a, b) => b.rate - a.rate);
          for (const v of remaining) {
            if (curated.length >= 3) break;
            curated.push({ ...v, curatedReason: getCuratedReason(v.curatorName) });
          }
        }

        setFavorites(curated);
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

  if (favorites.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Featured Vaults</h3>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {favorites.map((vault) => (
          <Link
            key={vault.address}
            href={`/vault/${vault.address}`}
            className="bg-background-subtle border border-border rounded-xl p-5 hover:border-accent-blue transition-colors group"
          >
            {/* Top row */}
            <div className="flex items-center gap-1.5 mb-3">
              <span className="px-2 py-0.5 bg-accent-green/10 text-accent-green text-[10px] rounded font-medium border border-accent-green/20">
                High Grade
              </span>
              <VaultGradeBadge grade={vault.grade} failures={vault.gradeFailures} />
            </div>

            {/* Vault name + curator */}
            <div className="mb-0.5">
              <span className="text-sm font-bold text-text-primary group-hover:text-accent-blue transition-colors truncate">
                {vault.name}
              </span>
            </div>
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
                {vault.curatedReason}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* CTA to Calculator */}
      <Link
        href="/calculator"
        className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-accent-blue/20 bg-accent-blue/5 text-sm font-medium text-accent-blue hover:bg-accent-blue/10 transition-colors"
      >
        Find More Vaults with LP Calculator
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils/format";
import { getVaultDepositUrl, getDepositLabel } from "@/lib/utils/morpho";
import { DataSourceBadge } from "./DataSourceBadge";

interface TopVault {
  address: string;
  name: string;
  symbol: string;
  curatorAddress: string | null;
  curatorName?: string | null;
  dataSource?: string | null;
  turtleId?: string | null;
  latestSnapshot: {
    totalAssetsUsd: number;
    avgNetApy: number | null;
  } | null;
  riskAssessment?: {
    overallRisk: string;
    overallScore: number;
  };
}

function RiskBadge({ risk }: { risk: string }) {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-text-muted bg-background-elevated">
      In Progress
    </span>
  );
}

type DataSourceFilter = "all" | "morpho" | "turtle";

const DATA_SOURCE_OPTIONS: { value: DataSourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "morpho", label: "Morpho [TBA]" },
  { value: "turtle", label: "Turtle" },
];

export function TopVaults() {
  const [vaults, setVaults] = useState<TopVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSourceFilter, setDataSourceFilter] = useState<DataSourceFilter>("all");
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (dataSourceFilter !== "all") {
          params.set("dataSource", dataSourceFilter);
        }
        const url = `/api/vaults${params.toString() ? `?${params.toString()}` : ""}`;
        const response = await fetch(url);
        const result = await response.json();

        if (result.success && result.data) {
          // Sort by TVL and take top 5
          const sorted = result.data
            .filter((v: TopVault) => v.latestSnapshot?.totalAssetsUsd)
            .sort(
              (a: TopVault, b: TopVault) =>
                (b.latestSnapshot?.totalAssetsUsd || 0) -
                (a.latestSnapshot?.totalAssetsUsd || 0)
            )
            .slice(0, 5);
          setVaults(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch top vaults:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [dataSourceFilter]);

  if (loading) {
    return (
      <div className="bg-background-subtle border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-24 bg-background-elevated rounded animate-pulse" />
          <div className="h-4 w-16 bg-background-elevated rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 bg-background-elevated rounded animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-background-elevated rounded animate-pulse mb-1" />
                <div className="h-3 w-20 bg-background-elevated rounded animate-pulse" />
              </div>
              <div className="h-4 w-16 bg-background-elevated rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-subtle border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Top Vaults</h3>
        <Link
          href="/vaults"
          className="text-xs text-accent-blue hover:text-accent-blue-hover transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="flex items-center gap-1 mb-3">
        {DATA_SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDataSourceFilter(opt.value)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              dataSourceFilter === opt.value
                ? "bg-accent-blue text-white"
                : "bg-background-elevated text-text-muted hover:text-text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {vaults.map((vault, index) => (
          <div
            key={vault.address}
            onClick={() => router.push(`/vault/${vault.address}`)}
            className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-background-hover transition-colors group cursor-pointer"
          >
            <span className="w-5 text-xs font-medium text-text-muted text-center">
              {index + 1}
            </span>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue/20 to-accent-blue/5 border border-accent-blue/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-accent-blue">
                {vault.symbol?.slice(0, 2) || "V"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center text-sm font-medium text-text-primary truncate group-hover:text-accent-blue transition-colors">
                {vault.name}
                <DataSourceBadge dataSource={vault.dataSource} />
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-text-tertiary">{vault.symbol}</span>
                {vault.riskAssessment && (
                  <RiskBadge risk={vault.riskAssessment.overallRisk} />
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-text-primary tabular-nums">
                {formatCurrency(vault.latestSnapshot?.totalAssetsUsd || 0)}
              </p>
              {vault.latestSnapshot?.avgNetApy && (
                <p className="text-xs text-accent-green tabular-nums">
                  {(vault.latestSnapshot.avgNetApy * 100).toFixed(2)}% APY
                </p>
              )}
            </div>
            <a
              href={getVaultDepositUrl(vault.address, vault.name, vault.dataSource, vault.turtleId)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all ${
                vault.dataSource === "turtle"
                  ? "hover:bg-cyan-500/10 text-text-muted hover:text-cyan-500"
                  : "hover:bg-accent-green/10 text-text-muted hover:text-accent-green"
              }`}
              title={getDepositLabel(vault.dataSource)}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

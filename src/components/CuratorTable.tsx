"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CuratorDashboardItem } from "@/lib/types/api";
import {
  formatCurrency,
  formatPercentage,
  formatTimeAgo,
} from "@/lib/utils/format";
import { CuratorAvatar } from "@/components/CuratorAvatar";

type SortField = "name" | "aum" | "vaults" | "apy" | "strategy" | "risk" | "change";
type SortDirection = "asc" | "desc";

interface CuratorTableProps {
  curators: CuratorDashboardItem[];
}

function getRiskBadge(risk: "low" | "medium" | "high") {
  switch (risk) {
    case "low":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-green/15 text-accent-green border border-accent-green/20">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
          Low
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/20">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow" />
          Med
        </span>
      );
    case "high":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-red/15 text-accent-red border border-accent-red/20">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
          High
        </span>
      );
  }
}

function getStrategyBadge(strategy: "Conservative" | "Moderate" | "Aggressive") {
  switch (strategy) {
    case "Conservative":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
          Conservative
        </span>
      );
    case "Moderate":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
          Moderate
        </span>
      );
    case "Aggressive":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-accent-red/10 text-accent-red border border-accent-red/20">
          Aggressive
        </span>
      );
  }
}

export function CuratorTable({ curators }: CuratorTableProps) {
  const [sortField, setSortField] = useState<SortField>("aum");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedCurators = useMemo(() => {
    return [...curators].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "name":
          aValue = (a.name || "").toLowerCase();
          bValue = (b.name || "").toLowerCase();
          break;
        case "aum":
          aValue = a.totalAUM;
          bValue = b.totalAUM;
          break;
        case "vaults":
          aValue = a.vaultCount;
          bValue = b.vaultCount;
          break;
        case "apy":
          aValue = a.avgNetApy;
          bValue = b.avgNetApy;
          break;
        case "strategy":
          const strategyOrder = { Conservative: 0, Moderate: 1, Aggressive: 2 };
          aValue = strategyOrder[a.strategyType];
          bValue = strategyOrder[b.strategyType];
          break;
        case "risk":
          const riskOrder = { low: 0, medium: 1, high: 2 };
          aValue = riskOrder[a.riskScore];
          bValue = riskOrder[b.riskScore];
          break;
        case "change":
          aValue = a.tvlChangePct30d;
          bValue = b.tvlChangePct30d;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [curators, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <span className="ml-1 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </span>
      );
    }
    return (
      <span className="ml-1 text-accent-blue">
        {sortDirection === "asc" ? (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </span>
    );
  };

  const HeaderCell = ({
    field,
    children,
    align = "left",
  }: {
    field: SortField;
    children: React.ReactNode;
    align?: "left" | "right" | "center";
  }) => (
    <th
      className={`px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary group select-none transition-colors ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${sortField === field ? "text-text-primary" : ""}`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center">
        {children}
        <SortIcon field={field} />
      </span>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background-subtle">
      <table className="min-w-full">
        <thead className="bg-background-elevated border-b border-border">
          <tr>
            <HeaderCell field="name">Curator</HeaderCell>
            <HeaderCell field="aum" align="right">Total AUM</HeaderCell>
            <HeaderCell field="vaults" align="right"># Vaults</HeaderCell>
            <HeaderCell field="apy" align="right">Avg APY</HeaderCell>
            <HeaderCell field="strategy" align="center">Strategy</HeaderCell>
            <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider text-left">
              Assets
            </th>
            <HeaderCell field="risk" align="center">Risk</HeaderCell>
            <HeaderCell field="change" align="right">30d Change</HeaderCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {sortedCurators.map((curator) => (
            <tr
              key={curator.curatorId}
              className="hover:bg-background-hover transition-colors"
            >
              {/* Curator Name */}
              <td className="px-4 py-4 whitespace-nowrap">
                <Link href={`/curator/${curator.curatorAddress}`} className="block group">
                  <div className="flex items-center gap-3">
                    <CuratorAvatar
                      address={curator.curatorAddress}
                      name={curator.name}
                      logoUrl={curator.logoUrl}
                      size="sm"
                    />
                    <div>
                      <div className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                        {curator.name || `Curator ${curator.curatorAddress.slice(0, 6)}...${curator.curatorAddress.slice(-4)}`}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {curator.jurisdiction || curator.entityType || ""}
                      </div>
                    </div>
                  </div>
                </Link>
              </td>

              {/* Total AUM */}
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="text-sm font-semibold text-text-primary tabular-nums">
                  {formatCurrency(curator.totalAUM)}
                </span>
              </td>

              {/* # Vaults */}
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="text-sm text-text-secondary tabular-nums">
                  {curator.vaultCount}
                </span>
              </td>

              {/* Avg APY */}
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="text-sm font-medium text-accent-green tabular-nums">
                  {formatPercentage(curator.avgNetApy)}
                </span>
              </td>

              {/* Strategy */}
              <td className="px-4 py-4 whitespace-nowrap text-center">
                {getStrategyBadge(curator.strategyType)}
              </td>

              {/* Asset Distribution */}
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  {curator.assetDistribution.slice(0, 3).map((asset, i) => (
                    <span
                      key={asset.symbol}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-background-elevated border border-border text-text-secondary"
                      title={`${asset.symbol}: ${formatCurrency(asset.amountUsd)} (${asset.percentage.toFixed(0)}%)`}
                    >
                      {asset.symbol}
                      <span className="ml-1 text-text-muted">{asset.percentage.toFixed(0)}%</span>
                    </span>
                  ))}
                  {curator.assetDistribution.length > 3 && (
                    <span className="text-xs text-text-muted">
                      +{curator.assetDistribution.length - 3}
                    </span>
                  )}
                </div>
              </td>

              {/* Risk Score */}
              <td className="px-4 py-4 whitespace-nowrap text-center">
                {getRiskBadge(curator.riskScore)}
              </td>

              {/* 30d Change */}
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <div className="flex flex-col items-end">
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      curator.tvlChangePct30d >= 0
                        ? "text-accent-green"
                        : "text-accent-red"
                    }`}
                  >
                    {curator.tvlChangePct30d >= 0 ? "+" : ""}
                    {curator.tvlChangePct30d.toFixed(1)}%
                  </span>
                  <span className="text-xs text-text-muted tabular-nums">
                    {curator.tvlChange30d >= 0 ? "+" : ""}
                    {formatCurrency(curator.tvlChange30d)}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CuratorTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background-subtle animate-pulse">
      <table className="min-w-full">
        <thead className="bg-background-elevated border-b border-border">
          <tr>
            {["Curator", "Total AUM", "# Vaults", "Avg APY", "Strategy", "Assets", "Risk", "30d Change"].map((header) => (
              <th key={header} className="px-4 py-3 text-left">
                <div className="h-3 w-16 bg-background-elevated rounded" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <tr key={i}>
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-background-elevated rounded-lg" />
                  <div>
                    <div className="h-4 w-24 bg-background-elevated rounded mb-1" />
                    <div className="h-3 w-16 bg-background-elevated/50 rounded" />
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-right">
                <div className="h-4 w-20 bg-background-elevated rounded ml-auto" />
              </td>
              <td className="px-4 py-4 text-right">
                <div className="h-4 w-8 bg-background-elevated rounded ml-auto" />
              </td>
              <td className="px-4 py-4 text-right">
                <div className="h-4 w-12 bg-background-elevated rounded ml-auto" />
              </td>
              <td className="px-4 py-4 text-center">
                <div className="h-5 w-20 bg-background-elevated rounded mx-auto" />
              </td>
              <td className="px-4 py-4">
                <div className="flex gap-1">
                  <div className="h-5 w-14 bg-background-elevated rounded" />
                  <div className="h-5 w-14 bg-background-elevated rounded" />
                </div>
              </td>
              <td className="px-4 py-4 text-center">
                <div className="h-5 w-12 bg-background-elevated rounded mx-auto" />
              </td>
              <td className="px-4 py-4 text-right">
                <div className="h-4 w-12 bg-background-elevated rounded ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

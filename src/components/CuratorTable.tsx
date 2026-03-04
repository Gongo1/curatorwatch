"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CuratorDashboardItem } from "@/lib/types/api";
import {
  formatCurrency,
  formatTimeAgo,
} from "@/lib/utils/format";
import { CuratorAvatar } from "@/components/CuratorAvatar";
import { curatorSlug } from "@/lib/curator-aliases";
import { ProtocolBadgeList } from "@/components/ProtocolBadge";

type SortField = "name" | "aum" | "vaults";
type SortDirection = "asc" | "desc";

interface CuratorTableProps {
  curators: CuratorDashboardItem[];
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
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-background-subtle">
        <table className="min-w-full">
          <thead className="bg-background-elevated border-b border-border">
            <tr>
              <HeaderCell field="name">Curator</HeaderCell>
              <HeaderCell field="aum" align="right">Total AUM</HeaderCell>
              <HeaderCell field="vaults" align="right"># Vaults</HeaderCell>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider text-left">
                Protocols
              </th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider text-left">
                Assets
              </th>
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
                  <Link href={`/curator/${curatorSlug(curator.name, curator.curatorAddress)}`} className="block group">
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

                {/* Protocols */}
                <td className="px-4 py-4 whitespace-nowrap">
                  <ProtocolBadgeList protocols={curator.protocols ?? ["morpho"]} />
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

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {sortedCurators.map((curator) => (
          <Link
            key={curator.curatorId}
            href={`/curator/${curatorSlug(curator.name, curator.curatorAddress)}`}
            className="block bg-background-subtle border border-border rounded-lg p-4 hover:bg-background-hover transition-colors"
          >
            <div className="flex items-start gap-3">
              <CuratorAvatar
                address={curator.curatorAddress}
                name={curator.name}
                logoUrl={curator.logoUrl}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-text-primary truncate">
                      {curator.name || `Curator ${curator.curatorAddress.slice(0, 6)}...`}
                    </h3>
                    <p className="text-xs text-text-tertiary">
                      {curator.jurisdiction || curator.entityType || `${curator.vaultCount} vaults`}
                    </p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-text-muted">AUM</p>
                    <p className="text-sm font-semibold text-text-primary tabular-nums">
                      {formatCurrency(curator.totalAUM)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Vaults</p>
                    <p className="text-sm text-text-secondary tabular-nums">
                      {curator.vaultCount}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 flex-wrap">
                  {curator.assetDistribution.slice(0, 2).map((asset) => (
                    <span
                      key={asset.symbol}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-background-elevated border border-border text-text-secondary"
                    >
                      {asset.symbol}
                    </span>
                  ))}
                  {curator.assetDistribution.length > 2 && (
                    <span className="text-xs text-text-muted">
                      +{curator.assetDistribution.length - 2}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

export function CuratorTableSkeleton() {
  return (
    <>
      {/* Desktop Table Skeleton */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border bg-background-subtle animate-pulse">
        <table className="min-w-full">
          <thead className="bg-background-elevated border-b border-border">
            <tr>
              {["Curator", "Total AUM", "# Vaults", "Protocols", "Assets"].map((header) => (
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
                <td className="px-4 py-4">
                  <div className="flex gap-1">
                    <div className="h-5 w-14 bg-background-elevated rounded" />
                    <div className="h-5 w-14 bg-background-elevated rounded" />
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="h-6 w-14 bg-background-elevated rounded mx-auto" />
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="h-4 w-12 bg-background-elevated rounded ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Skeleton */}
      <div className="md:hidden space-y-3 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-background-subtle border border-border rounded-lg p-4"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-background-elevated rounded-lg flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="h-4 w-28 bg-background-elevated rounded mb-1" />
                    <div className="h-3 w-16 bg-background-elevated/50 rounded" />
                  </div>
                  <div className="h-4 w-10 bg-background-elevated rounded" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <div className="h-3 w-8 bg-background-elevated/50 rounded mb-1" />
                    <div className="h-4 w-14 bg-background-elevated rounded" />
                  </div>
                  <div>
                    <div className="h-3 w-10 bg-background-elevated/50 rounded mb-1" />
                    <div className="h-4 w-6 bg-background-elevated rounded" />
                  </div>
                  <div>
                    <div className="h-3 w-6 bg-background-elevated/50 rounded mb-1" />
                    <div className="h-4 w-10 bg-background-elevated rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

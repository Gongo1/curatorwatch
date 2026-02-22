"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { VaultData } from "@/lib/types/api";
import {
  formatCurrency,
  formatPercentage,
  formatAddress,
} from "@/lib/utils/format";
import { ChangeCountBadge } from "./RecentChanges";

type SortField = "name" | "asset" | "tvl" | "apy" | "netApy" | "risk" | "curator";
type SortDirection = "asc" | "desc";

interface VaultTableProps {
  vaults: VaultData[];
  curatorFilter?: string;
}

// Generate a deterministic color from an address
function getAddressColor(address: string): string {
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-rose-500",
  ];
  const index = parseInt(address.slice(2, 4), 16) % colors.length;
  return colors[index];
}

export function VaultTable({ vaults, curatorFilter }: VaultTableProps) {
  const [sortField, setSortField] = useState<SortField>("tvl");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const filteredAndSortedVaults = useMemo(() => {
    // First filter by curator if a filter is set
    let filtered = vaults;
    if (curatorFilter) {
      filtered = vaults.filter(
        (vault) => vault.curatorAddress?.toLowerCase() === curatorFilter.toLowerCase()
      );
    }

    // Then sort
    return [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "asset":
          aValue = a.asset.symbol.toLowerCase();
          bValue = b.asset.symbol.toLowerCase();
          break;
        case "tvl":
          aValue = a.latestSnapshot?.totalAssetsUsd ?? 0;
          bValue = b.latestSnapshot?.totalAssetsUsd ?? 0;
          break;
        case "apy":
          aValue = a.latestSnapshot?.avgApy ?? 0;
          bValue = b.latestSnapshot?.avgApy ?? 0;
          break;
        case "netApy":
          aValue = a.latestSnapshot?.avgNetApy ?? 0;
          bValue = b.latestSnapshot?.avgNetApy ?? 0;
          break;
        case "risk":
          aValue = a.riskAssessment?.overallScore ?? 0;
          bValue = b.riskAssessment?.overallScore ?? 0;
          break;
        case "curator":
          aValue = a.curatorAddress?.toLowerCase() ?? "";
          bValue = b.curatorAddress?.toLowerCase() ?? "";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [vaults, sortField, sortDirection, curatorFilter]);

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
    align?: "left" | "right";
  }) => (
    <th
      className={`px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-primary group select-none transition-colors ${
        align === "right" ? "text-right" : "text-left"
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
            <HeaderCell field="name">Vault</HeaderCell>
            <HeaderCell field="asset">Asset</HeaderCell>
            <HeaderCell field="tvl" align="right">Deposits</HeaderCell>
            <HeaderCell field="apy" align="right">APY</HeaderCell>
            <HeaderCell field="netApy" align="right">Net APY</HeaderCell>
            <HeaderCell field="risk" align="right">Risk</HeaderCell>
            <th className="px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider text-center">
              Changes
            </th>
            <HeaderCell field="curator">Curator</HeaderCell>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {filteredAndSortedVaults.map((vault) => (
            <tr
              key={vault.id}
              className="hover:bg-background-hover transition-colors"
            >
              <td className="px-4 py-4 whitespace-nowrap">
                <Link href={`/vault/${vault.address}`} className="block group">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${getAddressColor(vault.address)} flex items-center justify-center text-white font-bold text-xs`}>
                      {vault.symbol.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                        {vault.name}
                      </div>
                      <div className="text-xs text-text-tertiary font-mono">
                        {formatAddress(vault.address)}
                      </div>
                    </div>
                  </div>
                </Link>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-background-elevated border border-border text-text-primary">
                  {vault.asset.symbol}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="text-sm font-semibold text-text-primary tabular-nums">
                  {formatCurrency(vault.latestSnapshot?.totalAssetsUsd)}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="text-sm text-text-secondary tabular-nums">
                  {formatPercentage(vault.latestSnapshot?.avgApy)}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <span className="text-sm font-medium text-accent-green tabular-nums">
                  {formatPercentage(vault.latestSnapshot?.avgNetApy)}
                </span>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <RiskBadge riskAssessment={vault.riskAssessment} />
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-center">
                <ChangeCountBadge vaultAddress={vault.address} />
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                {vault.curatorAddress ? (
                  <span className="text-sm text-text-tertiary font-mono">
                    {formatAddress(vault.curatorAddress)}
                  </span>
                ) : (
                  <span className="text-sm text-text-muted">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Risk badge component for the vault table
function RiskBadge({
  riskAssessment,
}: {
  riskAssessment?: {
    overallRisk: "Low Risk" | "Moderate Risk" | "High Risk";
    overallScore: number;
  };
}) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background-elevated">
      <span className="text-xs font-medium text-text-muted">In Progress</span>
    </div>
  );
}

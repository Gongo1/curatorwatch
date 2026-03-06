"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency } from "@/lib/utils/format";
import { curatorSlug } from "@/lib/curator-aliases";

interface LiquidationEvent {
  txHash: string;
  timestamp: string;
  marketUniqueKey: string;
  borrower: string;
  seizedAssetsUsd: number;
  repaidAssetsUsd: number;
  badDebtAssetsUsd: number;
}

interface CuratorLiquidationData {
  curatorId: string;
  curatorName: string;
  curatorAddress: string;
  totalEvents: number;
  totalSeizedUsd: number;
  totalRepaidUsd: number;
  totalBadDebtUsd: number;
  recent30d: number;
  events: LiquidationEvent[];
}

interface LiquidationSummary {
  totalEvents: number;
  totalSeizedUsd: number;
  totalRepaidUsd: number;
  totalBadDebtUsd: number;
  recent30d: number;
  marketsAffected: number;
}

type SortDir = "asc" | "desc";
type LiqSortKey = "name" | "events" | "seized" | "repaid" | "badDebt" | "recent30d";

export default function LiquidationsPage() {
  const [summary, setSummary] = useState<LiquidationSummary | null>(null);
  const [byCurator, setByCurator] = useState<CuratorLiquidationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<{ key: LiqSortKey; dir: SortDir }>({ key: "seized", dir: "desc" });
  const [expandedCurator, setExpandedCurator] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/stats/liquidation-breakdown");
        const data = await res.json();
        if (data.success) {
          setSummary(data.data.summary);
          setByCurator(data.data.byCurator);
        }
      } catch (err) {
        console.error("Failed to fetch liquidations:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const sortedCurators = useMemo(() => {
    const rows = [...byCurator];
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (sort.key) {
        case "name":
          return dir * a.curatorName.localeCompare(b.curatorName);
        case "events":
          return dir * (a.totalEvents - b.totalEvents);
        case "seized":
          return dir * (a.totalSeizedUsd - b.totalSeizedUsd);
        case "repaid":
          return dir * (a.totalRepaidUsd - b.totalRepaidUsd);
        case "badDebt":
          return dir * (a.totalBadDebtUsd - b.totalBadDebtUsd);
        case "recent30d":
          return dir * (a.recent30d - b.recent30d);
        default:
          return 0;
      }
    });
    return rows;
  }, [byCurator, sort]);

  function toggleSort(key: LiqSortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Liquidations" description="Liquidation events across curated vaults" breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Liquidations" }]} />
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-background-elevated rounded-xl" />
            <div className="h-24 bg-background-elevated rounded-xl" />
            <div className="h-24 bg-background-elevated rounded-xl" />
          </div>
          <div className="h-64 bg-background-elevated rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Liquidations" description="Liquidation events across curated vaults" breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Liquidations" }]} />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            label="Total Liquidation Events"
            value={summary.totalEvents.toLocaleString()}
            subtext={`${summary.recent30d} in last 30 days`}
            highlight
            valueColor="text-accent-red"
          />
          <SummaryCard
            label="Total Collateral Seized"
            value={formatCurrency(summary.totalSeizedUsd)}
            subtext={`Across ${summary.marketsAffected} markets`}
          />
          <SummaryCard
            label="Total Bad Debt"
            value={formatCurrency(summary.totalBadDebtUsd)}
            subtext="Unrecovered losses"
            valueColor="text-accent-red"
          />
        </div>
      )}

      {/* Liquidation by Curator Table */}
      <div className="bg-background-subtle border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background-elevated/50">
                <SortableHeader label="Curator" sortKey="name" currentSort={sort} onSort={toggleSort} align="left" />
                <SortableHeader label="Events" sortKey="events" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Collateral Seized" sortKey="seized" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Debt Repaid" sortKey="repaid" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Bad Debt" sortKey="badDebt" currentSort={sort} onSort={toggleSort} />
                <SortableHeader label="Last 30d" sortKey="recent30d" currentSort={sort} onSort={toggleSort} />
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedCurators.map((curator) => {
                const isExpanded = expandedCurator === curator.curatorId;
                return (
                  <LiquidationCuratorRow
                    key={curator.curatorId}
                    curator={curator}
                    isExpanded={isExpanded}
                    onToggle={() =>
                      setExpandedCurator(isExpanded ? null : curator.curatorId)
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function SortableHeader<T extends string>({
  label,
  sortKey,
  currentSort,
  onSort,
  align = "right",
}: {
  label: string;
  sortKey: T;
  currentSort: { key: T; dir: SortDir };
  onSort: (key: T) => void;
  align?: "left" | "right";
}) {
  const isActive = currentSort.key === sortKey;
  return (
    <th
      className={`${align === "left" ? "text-left" : "text-right"} text-xs font-medium uppercase tracking-wider px-4 py-3 cursor-pointer select-none hover:text-text-primary transition-colors ${
        isActive ? "text-accent-blue" : "text-text-secondary"
      }`}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label}
        {isActive && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {currentSort.dir === "desc" ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            )}
          </svg>
        )}
      </span>
    </th>
  );
}

function LiquidationCuratorRow({
  curator,
  isExpanded,
  onToggle,
}: {
  curator: CuratorLiquidationData;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="hover:bg-background-elevated/30 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <Link href={`/curator/${curatorSlug(curator.curatorName, curator.curatorAddress)}`} className="group" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium text-text-primary group-hover:text-accent-blue transition-colors">{curator.curatorName}</p>
            <p className="text-xs text-text-tertiary font-mono">
              {curator.curatorAddress.slice(0, 6)}...{curator.curatorAddress.slice(-4)}
            </p>
          </Link>
        </td>
        <td className="text-right px-4 py-3">
          <span className="font-medium text-text-primary tabular-nums">
            {curator.totalEvents.toLocaleString()}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className="font-bold text-accent-red tabular-nums text-lg">
            {formatCurrency(curator.totalSeizedUsd)}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className="text-text-secondary tabular-nums">
            {formatCurrency(curator.totalRepaidUsd)}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className={`font-medium tabular-nums ${curator.totalBadDebtUsd > 0 ? "text-accent-red" : "text-text-secondary"}`}>
            {formatCurrency(curator.totalBadDebtUsd)}
          </span>
        </td>
        <td className="text-right px-4 py-3">
          <span className={`font-medium tabular-nums ${curator.recent30d > 0 ? "text-accent-red" : "text-text-secondary"}`}>
            {curator.recent30d}
          </span>
        </td>
        <td className="px-2">
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>

      {isExpanded && curator.events.length > 0 && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-background-elevated/40 border-t border-border px-6 py-4">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                Recent Liquidation Events
              </p>
              <div className="space-y-1">
                {curator.events.map((evt) => (
                  <div
                    key={`${evt.txHash}-${evt.borrower}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background-hover/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary">
                        {new Date(evt.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        <span className="text-text-muted ml-2 text-xs">
                          {new Date(evt.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </p>
                      <p className="text-xs text-text-tertiary font-mono">
                        Market: {evt.marketUniqueKey.slice(0, 8)}...{evt.marketUniqueKey.slice(-6)}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-medium text-accent-red tabular-nums">
                          {formatCurrency(evt.seizedAssetsUsd)}
                        </p>
                        <p className="text-[10px] text-text-muted">seized</p>
                      </div>
                      <div className="text-right w-24">
                        <p className="text-sm text-text-secondary tabular-nums">
                          {formatCurrency(evt.repaidAssetsUsd)}
                        </p>
                        <p className="text-[10px] text-text-muted">repaid</p>
                      </div>
                      {evt.badDebtAssetsUsd > 0 && (
                        <div className="text-right w-24">
                          <p className="text-sm font-medium text-accent-red tabular-nums">
                            {formatCurrency(evt.badDebtAssetsUsd)}
                          </p>
                          <p className="text-[10px] text-text-muted">bad debt</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  highlight,
  valueColor,
}: {
  label: string;
  value: string;
  subtext: string;
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-accent-red/30 bg-accent-red/5"
          : "border-border bg-background-subtle"
      }`}
    >
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      <p
        className={`text-2xl font-bold tabular-nums ${
          valueColor || (highlight ? "text-accent-red" : "text-text-primary")
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-text-tertiary mt-1">{subtext}</p>
    </div>
  );
}

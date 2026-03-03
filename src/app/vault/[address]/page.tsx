"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  formatCurrency,
  formatPercentage,
  formatAddress,
  formatDate,
  formatTokenAmount,
  formatAdapterType,
  formatSharePrice,
} from "@/lib/utils/format";
import { getVaultDepositUrl, getDepositLabel } from "@/lib/utils/morpho";
import type { VaultDetail, VaultDetailApiResponse } from "@/lib/types/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Tabs";
import { ActivityTab } from "@/components/ActivityTab";
import { RiskTab } from "@/components/RiskTab";
import { StrategyIntelligence } from "@/components/StrategyIntelligence";
import { RecentChanges } from "@/components/RecentChanges";
import { CuratorSection, CuratorPlaceholder } from "@/components/CuratorSection";
import { FeesCard } from "@/components/FeesCard";
import { ProtocolBadge } from "@/components/ProtocolBadge";
import { NetworkBadge } from "@/components/NetworkBadge";
import { PageHeader } from "@/components/layout/PageHeader";

interface PageProps {
  params: Promise<{ address: string }>;
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
  const hash = address.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return colors[Math.abs(hash) % colors.length];
}

export default function VaultDetailPage({ params }: PageProps) {
  const { address } = use(params);
  const [vault, setVault] = useState<VaultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVault() {
      try {
        const response = await fetch(`/api/vaults/${address}`);
        const data: VaultDetailApiResponse = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Vault not found");
        }

        setVault(data.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load vault");
      } finally {
        setLoading(false);
      }
    }

    fetchVault();
  }, [address]);

  if (loading) {
    return <VaultDetailSkeleton />;
  }

  if (error || !vault) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6">
          <Link href="/" className="text-text-tertiary hover:text-text-primary transition-colors">
            Curators
          </Link>
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <Link href="/vaults" className="text-text-tertiary hover:text-text-primary transition-colors">
            All Vaults
          </Link>
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-text-primary font-medium">Vault</span>
        </nav>

        <div className="bg-background-subtle rounded-lg border border-accent-red/30 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-accent-red/15 flex items-center justify-center mx-auto">
            <svg
              className="h-8 w-8 text-accent-red"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-medium text-text-primary">
            Vault Not Found
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {error || "The vault you're looking for doesn't exist."}
          </p>
          <p className="mt-1 text-xs text-text-muted font-mono">{address}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary bg-background-elevated hover:bg-background-hover transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const snapshot = vault.latestSnapshot;
  const curatorName = vault.curator?.name || null;
  const curatorAddress = vault.curatorAddress;
  const isTurtleVault = vault.dataSource === "turtle";

  const breadcrumbs = curatorAddress
    ? [
        { label: "Dashboard", href: "/" },
        { label: curatorName || formatAddress(curatorAddress), href: `/curator/${curatorAddress}` },
        { label: vault.name },
      ]
    : [
        { label: "Dashboard", href: "/" },
        { label: "Vaults", href: "/vaults" },
        { label: vault.name },
      ];

  return (
    <>
      <PageHeader
        title={vault.name}
        description={`${curatorName ? `Curated by ${curatorName} \u2022 ` : ""}${vault.symbol} \u2022 ${vault.asset.symbol} \u2022 ${formatAddress(vault.address)}`}
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex items-center gap-3">
            <NetworkBadge network={vault.chainName ?? "Ethereum"} size="md" />
            <ProtocolBadge protocol={vault.protocol ?? "morpho"} size="md" />
            <a
              href={getVaultDepositUrl(vault.address, vault.name, vault.dataSource, vault.turtleId)}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isTurtleVault
                  ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/15"
                  : "bg-accent-green/10 border border-accent-green/20 text-accent-green hover:bg-accent-green/15"
              }`}
            >
              {getDepositLabel(vault.dataSource)}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-background-elevated border border-border text-text-primary">{vault.asset.symbol}</span>
          </div>
        }
      />

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <MetricCard
            label="Total Deposits"
            value={formatCurrency(snapshot?.totalAssetsUsd)}
            highlight
          />
          <MetricCard
            label="Liquidity"
            value={formatCurrency(snapshot?.liquidityUsd)}
          />
          <MetricCard
            label="APY"
            value={formatPercentage(snapshot?.avgApy)}
          />
          <MetricCard
            label="Net APY"
            value={formatPercentage(snapshot?.avgNetApy)}
            valueClass="text-accent-green"
          />
          <MetricCard
            label="Share Price"
            value={formatSharePrice(snapshot?.sharePrice)}
          />
        </div>

        {/* Yield Payouts */}
        {vault.yield && (
          <div className="mb-6 p-4 bg-accent-green/5 border border-accent-green/20 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Yield Payouts</h3>
                <p className="text-xs text-text-tertiary">Estimated yield generated for depositors</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-text-secondary mb-0.5">Daily</p>
                <p className="text-lg font-bold text-accent-green tabular-nums">
                  {formatCurrency(vault.yield.dailyYield)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-0.5">Weekly</p>
                <p className="text-lg font-bold text-accent-green tabular-nums">
                  {formatCurrency(vault.yield.weeklyYield)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-0.5">Monthly</p>
                <p className="text-lg font-bold text-accent-green tabular-nums">
                  {formatCurrency(vault.yield.monthlyYield)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-0.5">Annualized</p>
                <p className="text-lg font-bold text-accent-green tabular-nums">
                  {formatCurrency(vault.yield.annualizedYield)}
                </p>
              </div>
            </div>
            {vault.yield.vaultAgeDays > 0 && (
              <p className="mt-3 text-xs text-text-tertiary">
                Vault age: {vault.yield.vaultAgeDays} days • Est. total yield since launch: {formatCurrency(vault.yield.estimatedTotalYield)}
              </p>
            )}
          </div>
        )}

        {/* Tabbed Content */}
        <Tabs defaultValue="overview">
          <TabsList className="rounded-t-lg">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {!isTurtleVault && <TabsTrigger value="activity">Activity</TabsTrigger>}
            {!isTurtleVault && <TabsTrigger value="strategy">Strategy Intelligence</TabsTrigger>}
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-6 space-y-6">
            {/* Turtle data notice */}
            {isTurtleVault && (
              <div className="p-4 rounded-lg bg-accent-yellow/5 border border-accent-yellow/20">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-accent-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-text-primary">Cross-Protocol Vault</span>
                </div>
                <p className="text-xs text-text-secondary">
                  This vault is tracked via the Turtle Club API. TVL and APY data are available, but detailed allocations, transactions, reallocations, and risk snapshots are only available for Morpho vaults.
                  APY is calculated by CuratorWatch from the reported APR using daily compounding to enable consistent comparison across protocols.
                </p>
              </div>
            )}

            {/* Allocations Section */}
            <section className="bg-background-subtle rounded-lg border border-border">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-base font-semibold text-text-primary">
                  Asset Allocations
                </h2>
                <p className="text-sm text-text-tertiary">
                  How this vault's assets are deployed
                </p>
              </div>

              {vault.adapters.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-background-elevated flex items-center justify-center mx-auto">
                    <svg
                      className="h-6 w-6 text-text-muted"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="mt-3 text-sm text-text-secondary">
                    No allocation data available yet.
                  </p>
                  <p className="text-xs text-text-muted">
                    This vault may be new or data is still syncing.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-background-elevated border-b border-border">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Adapter Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Address
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                          USD Value
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                          % of Vault
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {vault.adapters.map((adapter, index) => (
                        <tr key={index} className="hover:bg-background-hover transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-accent-blue/10 border border-accent-blue/20 text-accent-blue">
                              {formatAdapterType(adapter.type)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-text-tertiary font-mono">
                              {formatAddress(adapter.address)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm text-text-secondary tabular-nums">
                              {formatTokenAmount(
                                adapter.assets,
                                vault.asset.decimals,
                                vault.asset.symbol
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm font-semibold text-text-primary tabular-nums">
                              {formatCurrency(adapter.assetsUsd)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-background-elevated rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-accent-blue rounded-full"
                                  style={{ width: `${Math.min(adapter.allocationPct, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm text-text-primary tabular-nums w-12 text-right">
                                {adapter.allocationPct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {/* Idle assets row if any */}
                      {vault.idleAssetsUsd > 0 && (
                        <tr className="bg-background-elevated/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-text-muted italic">
                              Idle (Unallocated)
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-text-muted">-</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm text-text-tertiary tabular-nums">
                              {formatTokenAmount(
                                vault.idleAssets,
                                vault.asset.decimals,
                                vault.asset.symbol
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm text-text-tertiary tabular-nums">
                              {formatCurrency(vault.idleAssetsUsd)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm text-text-tertiary tabular-nums">
                              {snapshot?.totalAssetsUsd
                                ? (
                                    (vault.idleAssetsUsd /
                                      snapshot.totalAssetsUsd) *
                                    100
                                  ).toFixed(1)
                                : "0"}
                              %
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Curator Section */}
            {vault.curator ? (
              <CuratorSection curator={vault.curator} />
            ) : (
              <CuratorPlaceholder curatorAddress={vault.curatorAddress} />
            )}

            {/* Fee Analysis */}
            <FeesCard vaultAddress={vault.address} />

            {/* Liquidations */}
            {vault.liquidationSummary && vault.liquidationSummary.total > 0 && (
              <section className="bg-background-subtle rounded-lg border border-border">
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="text-base font-semibold text-text-primary">Liquidations</h2>
                  <p className="text-sm text-text-tertiary">
                    Liquidation events in markets this vault supplies to
                  </p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-4">
                  <div>
                    <p className="text-xs text-text-secondary">Total Events</p>
                    <p className="text-lg font-semibold text-text-primary tabular-nums">
                      {vault.liquidationSummary.total}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Last 30 Days</p>
                    <p className={`text-lg font-semibold tabular-nums ${vault.liquidationSummary.recent30d > 0 ? "text-accent-red" : "text-text-primary"}`}>
                      {vault.liquidationSummary.recent30d}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Total Collateral Seized</p>
                    <p className="text-lg font-semibold text-accent-red tabular-nums">
                      {formatCurrency(vault.liquidationSummary.totalSeizedUsd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary">Bad Debt</p>
                    <p className={`text-lg font-semibold tabular-nums ${vault.liquidationSummary.totalBadDebtUsd > 0 ? "text-accent-red" : "text-text-muted"}`}>
                      {vault.liquidationSummary.totalBadDebtUsd > 0 ? formatCurrency(vault.liquidationSummary.totalBadDebtUsd) : "-"}
                    </p>
                  </div>
                </div>

                {vault.liquidations && vault.liquidations.length > 0 && (
                  <div className="overflow-x-auto border-t border-border">
                    <table className="min-w-full">
                      <thead className="bg-background-elevated border-b border-border">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Collateral Seized</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Debt Repaid</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">Bad Debt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {vault.liquidations.map((liq: { txHash: string; timestamp: string; seizedAssetsUsd: number; repaidAssetsUsd: number; badDebtAssetsUsd: number }, i: number) => (
                          <tr key={`${liq.txHash}-${i}`} className="hover:bg-background-hover transition-colors">
                            <td className="px-6 py-3 whitespace-nowrap">
                              <span className="text-sm text-text-secondary">{formatDate(liq.timestamp)}</span>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right">
                              <span className="text-sm font-medium text-accent-red tabular-nums">{formatCurrency(liq.seizedAssetsUsd)}</span>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right">
                              <span className="text-sm font-medium text-text-primary tabular-nums">{formatCurrency(liq.repaidAssetsUsd)}</span>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right">
                              <span className={`text-sm font-medium tabular-nums ${liq.badDebtAssetsUsd > 0 ? "text-accent-red" : "text-text-muted"}`}>
                                {liq.badDebtAssetsUsd > 0 ? formatCurrency(liq.badDebtAssetsUsd) : "-"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </TabsContent>

          <TabsContent value="activity" className="pt-6">
            <ActivityTab
              vaultAddress={vault.address}
              assetSymbol={vault.asset.symbol}
              assetDecimals={vault.asset.decimals}
            />
          </TabsContent>

          <TabsContent value="strategy" className="pt-6">
            <StrategyIntelligence vaultAddress={vault.address} />
          </TabsContent>

          <TabsContent value="alerts" className="pt-6">
            <section className="bg-background-subtle rounded-lg border border-border">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-base font-semibold text-text-primary">
                  Recent Alerts
                </h2>
                <p className="text-sm text-text-tertiary">
                  Significant alerts detected in the last 7 days
                </p>
              </div>
              <div className="p-6">
                <RecentChanges vaultAddress={vault.address} limit={20} />
              </div>
            </section>
          </TabsContent>
        </Tabs>
    </>
  );
}

function MetricCard({
  label,
  value,
  highlight,
  valueClass,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueClass?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-accent-blue/30 bg-accent-blue/5"
          : "border-border bg-background-subtle"
      }`}
    >
      <p className="text-sm text-text-secondary">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          valueClass || (highlight ? "text-accent-blue" : "text-text-primary")
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function VaultDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-5">
        <div className="h-4 w-48 bg-background-elevated rounded mb-2" />
        <div className="h-6 w-64 bg-background-elevated rounded mb-1" />
        <div className="h-4 w-40 bg-background-elevated rounded" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-background-subtle rounded-lg border border-border p-4">
            <div className="h-4 w-20 bg-background-elevated rounded mb-2" />
            <div className="h-8 w-24 bg-background-elevated rounded" />
          </div>
        ))}
      </div>

      <div className="bg-background-subtle rounded-lg border border-border p-6 mb-6">
        <div className="h-5 w-40 bg-background-elevated rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-background-elevated rounded" />
          ))}
        </div>
      </div>

      <div className="bg-background-subtle rounded-lg border border-border p-6">
        <div className="h-5 w-40 bg-background-elevated rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="h-4 w-24 bg-background-elevated rounded mb-2" />
              <div className="h-4 w-32 bg-background-elevated/50 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

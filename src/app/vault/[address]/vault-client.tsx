"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { DealContext } from "@/components/deposit/DealDepositDrawer";
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
import type { VaultDetail } from "@/lib/types/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Tabs";
import { ActivityTab } from "@/components/ActivityTab";
import { RiskTab } from "@/components/RiskTab";
import { StrategyIntelligence } from "@/components/StrategyIntelligence";
import { RecentChanges } from "@/components/RecentChanges";
import { CuratorSection, CuratorPlaceholder } from "@/components/CuratorSection";
import { curatorSlug } from "@/lib/curator-aliases";
import { FeesCard } from "@/components/FeesCard";
import { ProtocolBadge } from "@/components/ProtocolBadge";
import { NetworkBadge } from "@/components/NetworkBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { InfoTooltip } from "@/components/Tooltip";
import { VaultGradeBadge } from "@/components/VaultGradeBadge";
import { VaultWarningBadge } from "@/components/VaultWarningBadge";
import { MorphoVerifiedBadge } from "@/components/MorphoVerifiedBadge";
import { PendingConfigBanner } from "@/components/PendingConfigBanner";
import { isResolvUsrExposed, RESOLV_USR_WARNING } from "@/lib/resolv-usr-warning";

const AllocationCalculator = dynamic(() => import("@/components/AllocationCalculator").then(mod => mod.AllocationCalculator), {
  ssr: false,
  loading: () => <div className="h-64 bg-background-elevated rounded-xl animate-pulse" />,
});

// Wallet + deposit code loads only when the deal drawer is first opened.
const DealDepositDrawer = dynamic(
  () => import("@/components/deposit/DealDepositDrawer").then((m) => m.DealDepositDrawer),
  { ssr: false }
);
import { usePortfolio } from "@/hooks/usePortfolio";
import { TrackVaultPrompt } from "@/components/TrackVaultPrompt";

interface VaultDetailViewProps {
  address: string;
  vault: VaultDetail;
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

export function VaultDetailView({ address, vault }: VaultDetailViewProps) {
  const [showTrackPrompt, setShowTrackPrompt] = useState(false);
  const [drawerDeals, setDrawerDeals] = useState<DealContext[] | null>(null);
  const { isVaultTracked, trackVault, untrackVault } = usePortfolio();

  const isTracked = isVaultTracked(address);

  const snapshot = vault.latestSnapshot;
  const curatorName = vault.curator?.name || null;
  const curatorAddress = vault.curatorAddress;
  const isTurtleVault = vault.dataSource === "turtle";
  // Phase 3c: when this vault is mapped to a distributor deal, offer our own
  // attributed deposit flow ahead of the external protocol link.
  const dealUrl =
    process.env.NEXT_PUBLIC_FEATURE_TURTLE_DEPOSIT === "true" &&
    vault.dealDepositable &&
    vault.dealOpportunityId
      ? `/deposit?opportunity=${vault.dealOpportunityId}`
      : null;

  const breadcrumbs = curatorAddress
    ? [
        { label: "Curators", href: "/" },
        { label: curatorName || formatAddress(curatorAddress), href: `/curator/${curatorSlug(curatorName, curatorAddress)}` },
        { label: vault.name },
      ]
    : [
        { label: "Curators", href: "/" },
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
            <VaultGradeBadge grade={vault.grade} failures={vault.gradeFailures} atRisk={isResolvUsrExposed(vault.address)} />
            <VaultWarningBadge warnings={vault.warnings} />
            <MorphoVerifiedBadge listed={vault.listed} />
            <NetworkBadge network={vault.chainName ?? "Ethereum"} size="md" />
            {dealUrl && (
              <button
                type="button"
                onClick={() =>
                  setDrawerDeals([
                    {
                      opportunityId: vault.dealOpportunityId as string,
                      vaultName: vault.name,
                      curatorName,
                      assetSymbol: vault.asset.symbol,
                      estApr: vault.dealEstApr ?? null,
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/15"
              >
                Deposit{vault.dealEstApr != null ? ` · ${vault.dealEstApr.toFixed(1)}%` : ""}
              </button>
            )}
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
            <button
              onClick={() => isTracked ? untrackVault(address) : trackVault(address, vault.name)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isTracked
                  ? "bg-accent-blue/10 border border-accent-blue/20 text-accent-blue"
                  : "bg-background-elevated border border-border text-text-secondary hover:bg-background-hover"
              }`}
            >
              {isTracked ? "Tracking \u2713" : "Track"}
            </button>
          </div>
        }
      />

        {/* Resolv USR Warning Banner */}
        {isResolvUsrExposed(vault.address) && (
          <div className="mb-4 p-4 rounded-lg bg-accent-red/10 border-2 border-accent-red/40 flex items-start gap-3">
            <span className="text-xl flex-shrink-0">&#x1F6A8;</span>
            <div>
              <p className="text-sm font-bold text-accent-red">WARNING</p>
              <p className="text-sm text-accent-red/90 mt-0.5">{RESOLV_USR_WARNING}</p>
            </div>
          </div>
        )}

        {/* Pending Governance Changes Banner */}
        {!isTurtleVault && <PendingConfigBanner configs={vault.pendingConfigs} />}

        {/* Key Metrics */}
        <div className={`grid grid-cols-2 ${isTurtleVault ? "lg:grid-cols-4" : "lg:grid-cols-5"} gap-4 mb-4`}>
          <MetricCard
            label="Total Deposits"
            value={formatCurrency(snapshot?.totalAssetsUsd)}
            highlight
          />
          {!isTurtleVault && (
            <MetricCard
              label="Liquidity"
              value={formatCurrency(snapshot?.liquidityUsd)}
            />
          )}
          {isTurtleVault ? (
            <>
              <MetricCard
                label="Est. Total APR"
                value={vault.estTotalAPR != null ? `${vault.estTotalAPR.toFixed(2)}%` : "-"}
                tooltip="Estimated Total APR reported by the Turtle API (simple interest)"
              />
              <MetricCard
                label="Net APR"
                value={vault.netAPR != null ? `${vault.netAPR.toFixed(2)}%` : "-"}
                valueClass="text-accent-green"
                tooltip="Est. Total APR after performance and management fees"
              />
            </>
          ) : (
            <>
              <MetricCard
                label="APY"
                value={formatPercentage(snapshot?.avgApy)}
                tooltip="Time-weighted average annual yield before fees"
              />
              <MetricCard
                label="Net APY"
                value={formatPercentage(snapshot?.avgNetApy)}
                valueClass="text-accent-green"
                tooltip="Time-weighted average annual yield after fees — the actual return depositors earn"
              />
            </>
          )}
          {!isTurtleVault && (
            <MetricCard
              label="Share Price"
              value={formatSharePrice(snapshot?.sharePrice)}
            />
          )}
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
                {vault.creationTimestamp
                  ? `Launched ${formatDate(new Date(vault.creationTimestamp * 1000).toISOString())} (${vault.yield.vaultAgeDays} days ago)`
                  : `Vault age: ${vault.yield.vaultAgeDays} days`}
                {" "}• Est. total yield since launch: {formatCurrency(vault.yield.estimatedTotalYield)}
              </p>
            )}
          </div>
        )}

        {/* Tabbed Content */}
        <Tabs defaultValue="overview">
          <TabsList className="rounded-t-lg">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="calculator">LP Calculator</TabsTrigger>
            {!isTurtleVault && <TabsTrigger value="activity">Activity</TabsTrigger>}
            {!isTurtleVault && <TabsTrigger value="strategy">Strategy Intelligence</TabsTrigger>}
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-6 space-y-6">
            {/* Capital Efficiency Card — Morpho vaults only */}
            {!isTurtleVault && snapshot && vault.idleAssetsUsd != null && (
              <CapitalEfficiencyCard
                totalAssetsUsd={snapshot.totalAssetsUsd}
                idleAssetsUsd={vault.idleAssetsUsd}
              />
            )}

            {/* Turtle data notice */}
            {isTurtleVault && (
              <>
                <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-text-primary">Cross-Protocol Vault</span>
                  </div>
                  <p className="text-xs text-text-secondary">
                    APR from Turtle API. No transaction or allocation data available.
                    This vault displays Est. Total APR (simple interest) directly from the Turtle API.
                  </p>
                </div>

                {/* Fee Breakdown */}
                {(vault.fees.performance > 0 || vault.fees.management > 0) && (
                  <section className="bg-background-subtle rounded-lg border border-border">
                    <div className="px-6 py-4 border-b border-border">
                      <h2 className="text-base font-semibold text-text-primary">Fees</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-4 px-6 py-4">
                      <div>
                        <p className="text-xs text-text-secondary mb-0.5">Performance Fee</p>
                        <p className="text-lg font-semibold text-text-primary tabular-nums">
                          {(vault.fees.performance * 100).toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-secondary mb-0.5">Management Fee</p>
                        <p className="text-lg font-semibold text-text-primary tabular-nums">
                          {(vault.fees.management * 100).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* APR Sources / Incentive Breakdown */}
                {vault.aprBreakdown && vault.aprBreakdown.length > 0 && (
                  <section className="bg-background-subtle rounded-lg border border-border">
                    <div className="px-6 py-4 border-b border-border">
                      <h2 className="text-base font-semibold text-text-primary">APR Sources</h2>
                      <p className="text-sm text-text-tertiary">Breakdown of yield incentives</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-background-elevated border-b border-border">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Source</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">APR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                          {vault.aprBreakdown.map((incentive, i) => (
                            <tr key={i} className="hover:bg-background-hover transition-colors">
                              <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-text-primary">{incentive.source}</td>
                              <td className="px-6 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-500">
                                  {incentive.type}
                                </span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium text-accent-green tabular-nums">{incentive.apr.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
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

          <TabsContent value="calculator" className="pt-6">
            <AllocationCalculator vault={vault} />
          </TabsContent>

          <TabsContent value="activity" className="pt-6">
            <ActivityTab
              vaultAddress={vault.address}
              assetSymbol={vault.asset.symbol}
              assetDecimals={vault.asset.decimals}
            />
          </TabsContent>

          <TabsContent value="strategy" className="pt-6">
            <StrategyIntelligence vaultAddress={vault.address} grade={vault.grade} gradeFailures={vault.gradeFailures} />
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

      <TrackVaultPrompt
        name={vault.name}
        type="vault"
        open={showTrackPrompt}
        onClose={() => setShowTrackPrompt(false)}
      />

      {drawerDeals && (
        <DealDepositDrawer
          deals={drawerDeals}
          curatorName={curatorName}
          onClose={() => setDrawerDeals(null)}
        />
      )}
    </>
  );
}

function MetricCard({
  label,
  value,
  highlight,
  valueClass,
  tooltip,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueClass?: string;
  tooltip?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-accent-blue/30 bg-accent-blue/5"
          : "border-border bg-background-subtle"
      }`}
    >
      <div className="flex items-center gap-1">
        <p className="text-sm text-text-secondary">{label}</p>
        {tooltip && <InfoTooltip content={tooltip} />}
      </div>
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

function CapitalEfficiencyCard({
  totalAssetsUsd,
  idleAssetsUsd,
}: {
  totalAssetsUsd: number;
  idleAssetsUsd: number;
}) {
  const deployed = totalAssetsUsd - idleAssetsUsd;
  const efficiencyPct = totalAssetsUsd > 0 ? (deployed / totalAssetsUsd) * 100 : 0;

  let statusLabel: string;
  let statusColor: string;
  if (efficiencyPct >= 90) {
    statusLabel = "Excellent";
    statusColor = "text-accent-green";
  } else if (efficiencyPct >= 80) {
    statusLabel = "Good";
    statusColor = "text-accent-yellow";
  } else {
    statusLabel = "Poor";
    statusColor = "text-accent-red";
  }

  return (
    <section className="bg-background-subtle rounded-lg border border-border">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-text-primary">Capital Efficiency</h2>
        <p className="text-sm text-text-tertiary">How effectively vault capital is deployed</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-4">
        <div>
          <p className="text-xs text-text-secondary mb-0.5">Deployed Capital</p>
          <p className="text-lg font-semibold text-accent-green tabular-nums">
            {formatCurrency(deployed)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary mb-0.5">Idle Capital</p>
          <p className="text-lg font-semibold text-accent-yellow tabular-nums">
            {formatCurrency(idleAssetsUsd)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary mb-0.5">Efficiency</p>
          <p className="text-lg font-semibold text-text-primary tabular-nums">
            {efficiencyPct.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary mb-0.5">Status</p>
          <p className={`text-lg font-semibold ${statusColor}`}>
            {statusLabel}
          </p>
        </div>
      </div>
    </section>
  );
}

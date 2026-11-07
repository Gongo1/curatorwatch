"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
import { StrategyIntelligence } from "@/components/StrategyIntelligence";
import { RecentChanges } from "@/components/RecentChanges";
import { CuratorSection, CuratorPlaceholder } from "@/components/CuratorSection";
import { curatorSlug } from "@/lib/curator-aliases";
import { FeesCard } from "@/components/FeesCard";
import { ProtocolBadge } from "@/components/ProtocolBadge";
import { NetworkBadge } from "@/components/NetworkBadge";
import { FnTag } from "@/components/layout/FnTag";
import { Panel } from "@/components/layout/Panel";
import { InfoTooltip } from "@/components/Tooltip";
import { VaultWarningBadge } from "@/components/VaultWarningBadge";
import { MorphoVerifiedBadge } from "@/components/MorphoVerifiedBadge";
import { NotCountedNote } from "@/components/NotCountedNote";
import { PendingConfigBanner } from "@/components/PendingConfigBanner";
import { isResolvUsrExposed, RESOLV_USR_WARNING } from "@/lib/resolv-usr-warning";

const AllocationCalculator = dynamic(() => import("@/components/AllocationCalculator").then(mod => mod.AllocationCalculator), {
  ssr: false,
  loading: () => <div className="h-64 panel animate-pulse" />,
});

import { usePortfolio } from "@/hooks/usePortfolio";
import { TrackVaultPrompt } from "@/components/TrackVaultPrompt";
import { DataAsOf } from "@/components/DataAsOf";

interface VaultDetailViewProps {
  address: string;
  vault: VaultDetail;
}

export function VaultDetailView({ address, vault }: VaultDetailViewProps) {
  const [showTrackPrompt, setShowTrackPrompt] = useState(false);
  const { isVaultTracked, trackVault, untrackVault } = usePortfolio();

  const isTracked = isVaultTracked(address);

  const snapshot = vault.latestSnapshot;
  const curatorName = vault.curator?.name || null;
  const curatorAddress = vault.curatorAddress;
  const isTurtleVault = vault.dataSource === "turtle";

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

  const th = "label px-3 h-7";
  const tag = "label inline-flex items-center h-[1.35rem] px-1.5 border border-border-strong text-text-secondary";

  return (
    <div className="space-y-1.5">
      {/* Header: function tag, vault name, identity line, actions */}
      <header className="pb-3 mb-1.5 border-b border-border">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-2 label min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span className="text-text-muted">/</span>}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-accent-blue transition-colors truncate">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-text-secondary truncate">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <FnTag />
            <div className="min-w-0">
              <h1 className="cond text-[1.45rem] leading-none font-bold tracking-[0.01em] text-text-primary break-words">
                {vault.name}
              </h1>
              <p className="text-sm text-text-secondary mt-1.5">
                {curatorName && <>Curated by {curatorName} · </>}
                {vault.symbol} · {vault.asset.symbol} · <span className="num text-text-tertiary">{formatAddress(vault.address)}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <NetworkBadge network={vault.chainName ?? "Ethereum"} size="md" />
                <span className={tag}>{vault.asset.symbol}</span>
                <VaultWarningBadge warnings={vault.warnings} />
                <MorphoVerifiedBadge listed={vault.listed} />
                <NotCountedNote counting={vault.counting} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={getVaultDepositUrl(vault.address, vault.name, vault.dataSource, vault.turtleId)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost h-7"
            >
              {getDepositLabel(vault.dataSource)}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
            <button
              type="button"
              aria-pressed={isTracked}
              onClick={() => isTracked ? untrackVault(address) : trackVault(address, vault.name)}
              className={isTracked ? "btn h-7 border-accent-blue text-accent-blue" : "btn btn-ghost h-7"}
            >
              {isTracked ? "Tracking \u2713" : "Track"}
            </button>
          </div>
        </div>
      </header>

      {/* Resolv USR Warning Banner */}
      {isResolvUsrExposed(vault.address) && (
        <div role="alert" className="panel border-accent-red px-3 py-2.5 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-accent-red flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="label text-accent-red">Warning</p>
            <p className="text-sm text-text-primary mt-0.5">{RESOLV_USR_WARNING}</p>
          </div>
        </div>
      )}

      {/* Pending Governance Changes Banner */}
      {!isTurtleVault && <PendingConfigBanner configs={vault.pendingConfigs} />}

      {/* Key Metrics */}
      <section aria-label="Key metrics" className="panel">
        <dl className={`grid grid-cols-2 ${isTurtleVault ? "lg:grid-cols-3" : "lg:grid-cols-5"}`}>
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
        </dl>
        <div className="border-t border-border px-3 py-1.5 empty:hidden">
          <DataAsOf sources={[vault.dataSource]} />
        </div>
      </section>

      {/* Yield Payouts */}
      {vault.yield && (
        <Panel title="Yield payouts" meta="est. generated for depositors">
          <dl className="grid grid-cols-2 sm:grid-cols-4">
            {[
              ["Daily", vault.yield.dailyYield],
              ["Weekly", vault.yield.weeklyYield],
              ["Monthly", vault.yield.monthlyYield],
              ["Annualized", vault.yield.annualizedYield],
            ].map(([k, v]) => (
              <div key={k as string} className="px-3 py-2 border-r border-b sm:border-b-0 border-border-subtle last:border-r-0 min-w-0">
                <dt className="label">{k as string}</dt>
                <dd className="num text-base font-semibold text-text-primary mt-1 truncate">
                  {formatCurrency(v as number)}
                </dd>
              </div>
            ))}
          </dl>
          {vault.yield.vaultAgeDays > 0 && (
            <p className="px-3 py-1.5 border-t border-border-subtle text-xs text-text-tertiary">
              {vault.creationTimestamp
                ? `Launched ${formatDate(new Date(vault.creationTimestamp * 1000).toISOString())} (${vault.yield.vaultAgeDays} days ago)`
                : `Vault age: ${vault.yield.vaultAgeDays} days`}
              {" "}· Est. total yield since launch:{" "}
              <span className="num text-text-secondary">{formatCurrency(vault.yield.estimatedTotalYield)}</span>
            </p>
          )}
        </Panel>
      )}

      {/* Tabbed Content */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calculator">LP Calculator</TabsTrigger>
          {!isTurtleVault && <TabsTrigger value="activity">Activity</TabsTrigger>}
          {!isTurtleVault && <TabsTrigger value="strategy">Strategy Intelligence</TabsTrigger>}
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-1.5 space-y-1.5">
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
              <Panel title="Cross-protocol vault" bodyClassName="px-3 py-2">
                <p className="text-sm text-text-secondary">
                  APR from Turtle API. No transaction or allocation data available.
                  This vault displays Est. Total APR (simple interest) directly from the Turtle API.
                </p>
              </Panel>

              {/* Fee Breakdown */}
              {(vault.fees.performance > 0 || vault.fees.management > 0) && (
                <Panel title="Fees">
                  <dl className="grid grid-cols-2">
                    <div className="px-3 py-2 border-r border-border-subtle">
                      <dt className="label">Performance fee</dt>
                      <dd className="num text-base font-semibold text-text-primary mt-1">
                        {(vault.fees.performance * 100).toFixed(2)}%
                      </dd>
                    </div>
                    <div className="px-3 py-2">
                      <dt className="label">Management fee</dt>
                      <dd className="num text-base font-semibold text-text-primary mt-1">
                        {(vault.fees.management * 100).toFixed(2)}%
                      </dd>
                    </div>
                  </dl>
                </Panel>
              )}

              {/* APR Sources / Incentive Breakdown */}
              {vault.aprBreakdown && vault.aprBreakdown.length > 0 && (
                <Panel title="APR sources" meta="yield incentive breakdown">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-background">
                          <th scope="col" className={`${th} text-left`}>Source</th>
                          <th scope="col" className={`${th} text-left`}>Type</th>
                          <th scope="col" className={`${th} text-right`}>APR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vault.aprBreakdown.map((incentive, i) => (
                          <tr key={i} className="h-9 border-b border-border-subtle last:border-b-0 hover:bg-background-hover transition-colors">
                            <td className="px-3 whitespace-nowrap font-medium text-text-primary">{incentive.source}</td>
                            <td className="px-3 whitespace-nowrap">
                              <span className="label inline-flex items-center h-[1.15rem] px-1 border border-border-strong text-text-secondary">
                                {incentive.type}
                              </span>
                            </td>
                            <td className="px-3 whitespace-nowrap text-right num text-text-primary">{incentive.apr.toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
            </>
          )}

          {/* Allocations Section */}
          <Panel title="Asset allocations" meta="how this vault's assets are deployed">
            {vault.adapters.length === 0 ? (
              <div className="p-3">
                <p className="text-sm text-text-secondary">No allocation data for this vault yet.</p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  The vault may be new, or its data is still syncing. Check back after the next update.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background">
                      <th scope="col" className={`${th} text-left`}>Adapter type</th>
                      <th scope="col" className={`${th} text-left`}>Address</th>
                      <th scope="col" className={`${th} text-right`}>Amount</th>
                      <th scope="col" className={`${th} text-right`}>USD value</th>
                      <th scope="col" className={`${th} text-right`}>% of vault</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vault.adapters.map((adapter, index) => (
                      <tr key={index} className="h-9 border-b border-border-subtle last:border-b-0 hover:bg-background-hover transition-colors">
                        <td className="px-3 whitespace-nowrap">
                          <span className="label inline-flex items-center h-[1.15rem] px-1 border border-border-strong text-text-secondary">
                            {formatAdapterType(adapter.type)}
                          </span>
                        </td>
                        <td className="px-3 whitespace-nowrap num text-text-tertiary">
                          {formatAddress(adapter.address)}
                        </td>
                        <td className="px-3 whitespace-nowrap text-right num text-text-secondary">
                          {formatTokenAmount(adapter.assets, vault.asset.decimals, vault.asset.symbol)}
                        </td>
                        <td className="px-3 whitespace-nowrap text-right num font-semibold text-text-primary">
                          {formatCurrency(adapter.assetsUsd)}
                        </td>
                        <td className="px-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-background-elevated overflow-hidden" aria-hidden="true">
                              <div
                                className="h-full bg-accent-blue"
                                style={{ width: `${Math.min(adapter.allocationPct, 100)}%` }}
                              />
                            </div>
                            <span className="num text-text-primary w-12 text-right">
                              {adapter.allocationPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* Idle assets row if any */}
                    {vault.idleAssetsUsd > 0 && (
                      <tr className="h-9 bg-background">
                        <td className="px-3 whitespace-nowrap text-text-muted">Idle (unallocated)</td>
                        <td className="px-3 whitespace-nowrap text-text-muted">-</td>
                        <td className="px-3 whitespace-nowrap text-right num text-text-tertiary">
                          {formatTokenAmount(vault.idleAssets, vault.asset.decimals, vault.asset.symbol)}
                        </td>
                        <td className="px-3 whitespace-nowrap text-right num text-text-tertiary">
                          {formatCurrency(vault.idleAssetsUsd)}
                        </td>
                        <td className="px-3 whitespace-nowrap text-right num text-text-tertiary">
                          {snapshot?.totalAssetsUsd
                            ? ((vault.idleAssetsUsd / snapshot.totalAssetsUsd) * 100).toFixed(1)
                            : "0"}
                          %
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

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
            <Panel title="Liquidations" meta="in markets this vault supplies">
              <dl className="grid grid-cols-2 lg:grid-cols-4">
                <div className="px-3 py-2 border-r border-b lg:border-b-0 border-border-subtle">
                  <dt className="label">Total events</dt>
                  <dd className="num text-base font-semibold text-text-primary mt-1">
                    {vault.liquidationSummary.total}
                  </dd>
                </div>
                <div className="px-3 py-2 border-b lg:border-b-0 lg:border-r border-border-subtle">
                  <dt className="label">Last 30 days</dt>
                  <dd className={`num text-base font-semibold mt-1 ${vault.liquidationSummary.recent30d > 0 ? "text-accent-red" : "text-text-primary"}`}>
                    {vault.liquidationSummary.recent30d}
                  </dd>
                </div>
                <div className="px-3 py-2 border-r border-border-subtle">
                  <dt className="label">Collateral seized</dt>
                  <dd className="num text-base font-semibold text-accent-red mt-1">
                    {formatCurrency(vault.liquidationSummary.totalSeizedUsd)}
                  </dd>
                </div>
                <div className="px-3 py-2">
                  <dt className="label">Bad debt</dt>
                  <dd className={`num text-base font-semibold mt-1 ${vault.liquidationSummary.totalBadDebtUsd > 0 ? "text-accent-red" : "text-text-muted"}`}>
                    {vault.liquidationSummary.totalBadDebtUsd > 0 ? formatCurrency(vault.liquidationSummary.totalBadDebtUsd) : "-"}
                  </dd>
                </div>
              </dl>

              {vault.liquidations && vault.liquidations.length > 0 && (
                <div className="overflow-x-auto border-t border-border">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-background">
                        <th scope="col" className={`${th} text-left`}>Date</th>
                        <th scope="col" className={`${th} text-right`}>Collateral seized</th>
                        <th scope="col" className={`${th} text-right`}>Debt repaid</th>
                        <th scope="col" className={`${th} text-right`}>Bad debt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vault.liquidations.map((liq: { txHash: string; timestamp: string; seizedAssetsUsd: number; repaidAssetsUsd: number; badDebtAssetsUsd: number }, i: number) => (
                        <tr key={`${liq.txHash}-${i}`} className="h-8 border-b border-border-subtle last:border-b-0 hover:bg-background-hover transition-colors">
                          <td className="px-3 whitespace-nowrap num text-text-secondary">{formatDate(liq.timestamp)}</td>
                          <td className="px-3 whitespace-nowrap text-right num text-accent-red">{formatCurrency(liq.seizedAssetsUsd)}</td>
                          <td className="px-3 whitespace-nowrap text-right num text-text-primary">{formatCurrency(liq.repaidAssetsUsd)}</td>
                          <td className={`px-3 whitespace-nowrap text-right num ${liq.badDebtAssetsUsd > 0 ? "text-accent-red" : "text-text-muted"}`}>
                            {liq.badDebtAssetsUsd > 0 ? formatCurrency(liq.badDebtAssetsUsd) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="calculator" className="pt-1.5">
          <AllocationCalculator vault={vault} />
        </TabsContent>

        <TabsContent value="activity" className="pt-1.5">
          <ActivityTab
            vaultAddress={vault.address}
            assetSymbol={vault.asset.symbol}
            assetDecimals={vault.asset.decimals}
          />
        </TabsContent>

        <TabsContent value="strategy" className="pt-1.5">
          <StrategyIntelligence vaultAddress={vault.address} />
        </TabsContent>

        <TabsContent value="alerts" className="pt-1.5">
          <Panel title="Recent alerts" meta="last 7 days" bodyClassName="p-3">
            <RecentChanges vaultAddress={vault.address} limit={20} />
          </Panel>
        </TabsContent>
      </Tabs>

      <TrackVaultPrompt
        name={vault.name}
        type="vault"
        open={showTrackPrompt}
        onClose={() => setShowTrackPrompt(false)}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  highlight,
  tooltip,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="px-3 py-2.5 border-r border-b lg:border-b-0 border-border last:border-r-0 last:odd:col-span-2 lg:last:odd:col-span-1 min-w-0">
      <dt className="flex items-center gap-1 label">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </dt>
      <dd
        className={`mt-1.5 num font-semibold text-[1.45rem] leading-none truncate ${
          highlight ? "text-accent-blue" : "text-text-primary"
        }`}
      >
        {value}
      </dd>
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
    <Panel title="Capital efficiency" meta="how effectively capital is deployed">
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        <div className="px-3 py-2 border-r border-b lg:border-b-0 border-border-subtle">
          <dt className="label">Deployed capital</dt>
          <dd className="num text-base font-semibold text-text-primary mt-1">{formatCurrency(deployed)}</dd>
        </div>
        <div className="px-3 py-2 border-b lg:border-b-0 lg:border-r border-border-subtle">
          <dt className="label">Idle capital</dt>
          <dd className="num text-base font-semibold text-text-primary mt-1">{formatCurrency(idleAssetsUsd)}</dd>
        </div>
        <div className="px-3 py-2 border-r border-border-subtle">
          <dt className="label">Efficiency</dt>
          <dd className="num text-base font-semibold text-text-primary mt-1">{efficiencyPct.toFixed(1)}%</dd>
        </div>
        <div className="px-3 py-2">
          <dt className="label">Status</dt>
          <dd className={`text-base font-semibold mt-1 ${statusColor}`}>{statusLabel}</dd>
        </div>
      </dl>
    </Panel>
  );
}

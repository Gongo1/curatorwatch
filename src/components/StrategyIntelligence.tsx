"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { StrategyClassification } from "@/lib/strategy-classifier";
import { Panel } from "@/components/layout/Panel";

interface CuratorProfile {
  address: string;
  name: string | null;
  legalName: string | null;
  entityType: string | null;
  jurisdiction: string | null;
  foundedYear: number | null;
  isRegulated: boolean;
  totalAssetsManaged: number;
  vaultCount: number;
}

interface CollateralAsset {
  symbol: string;
  allocationPct: number;
  isBlueChip: boolean;
}

interface AlertSummary {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

interface RecentAlert {
  id: string;
  severity: string;
  title: string;
  detectedAt: string;
}

interface StrategyIntelligenceProps {
  vaultAddress: string;
  strategy?: StrategyClassification;
}

function curatorSlugFromName(name: string | null, address: string): string {
  if (!name) return address.toLowerCase();
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function StrategyIntelligence({ vaultAddress, strategy: initialStrategy }: StrategyIntelligenceProps) {
  const [strategy, setStrategy] = useState<StrategyClassification | null>(initialStrategy || null);
  const [curator, setCurator] = useState<CuratorProfile | null>(null);
  const [collateral, setCollateral] = useState<CollateralAsset[]>([]);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(!initialStrategy);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStrategy();
  }, [vaultAddress]);

  async function fetchStrategy() {
    try {
      setLoading(true);
      const response = await fetch(`/api/vaults/${vaultAddress}/strategy`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch strategy");
      }

      setStrategy(data.data.strategy);
      setCurator(data.data.curator);
      setCollateral(data.data.collateral ?? []);
      setAlertSummary(data.data.alertSummary ?? null);
      setRecentAlerts(data.data.recentAlerts ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategy");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <StrategyIntelligenceSkeleton />;
  }

  if (error || !strategy) {
    return (
      <Panel title="Strategy intelligence" bodyClassName="p-3 text-sm">
        <p className="text-accent-red">
          {error ? `Strategy analysis could not be loaded: ${error}` : "Strategy analysis is not available for this vault."}
        </p>
        <button type="button" onClick={fetchStrategy} className="btn btn-ghost h-7 mt-2">
          Try again
        </button>
      </Panel>
    );
  }

  const isKnownCurator = !!(curator && curator.name);
  const blueChipCount = collateral.filter((c) => c.isBlueChip).length;
  const exoticCount = collateral.filter((c) => !c.isBlueChip).length;

  const curatorHref = isKnownCurator
    ? `/curator/${curatorSlugFromName(curator!.name, curator!.address)}`
    : null;

  const tag = "label inline-flex items-center h-[1.15rem] px-1 border";

  return (
    <div className="space-y-1.5">
      {/* Unknown Curator Warning */}
      {!isKnownCurator && (
        <div role="alert" className="panel border-accent-red-muted px-3 py-2 flex items-start gap-2.5">
          <AlertTriangleIcon className="w-4 h-4 text-accent-red flex-shrink-0 mt-0.5" />
          <div>
            <p className="label text-accent-red">Unknown curator: exercise caution</p>
            <p className="text-sm text-text-secondary mt-0.5">
              No profile data available for this vault&apos;s curator. Classification confidence has been downgraded.
            </p>
          </div>
        </div>
      )}

      {/* Risk Overview */}
      <Panel title="Risk overview">
        <dl className="grid grid-cols-1 sm:grid-cols-3">
          <div className="px-3 py-2 border-b sm:border-b-0 sm:border-r border-border-subtle">
            <dt className="label">Recent alerts (7d)</dt>
            <dd className="mt-1 text-sm font-semibold">
              {alertSummary && alertSummary.total > 0 ? (
                <span className="flex items-center gap-2 flex-wrap">
                  {alertSummary.critical > 0 && (
                    <span className="text-accent-red"><span className="num">{alertSummary.critical}</span> Critical</span>
                  )}
                  {alertSummary.warning > 0 && (
                    <span className="text-accent-yellow"><span className="num">{alertSummary.warning}</span> Warning</span>
                  )}
                  {alertSummary.info > 0 && (
                    <span className="text-text-secondary"><span className="num">{alertSummary.info}</span> Info</span>
                  )}
                </span>
              ) : (
                <span className="text-accent-green">None</span>
              )}
            </dd>
          </div>
          <div className="px-3 py-2 border-b sm:border-b-0 sm:border-r border-border-subtle">
            <dt className="label">Collateral type</dt>
            <dd className="mt-1 text-sm font-semibold text-text-primary">
              {collateral.length > 0 ? (
                <>
                  {exoticCount > 0 && <span className="text-accent-yellow"><span className="num">{exoticCount}</span> Exotic</span>}
                  {exoticCount > 0 && blueChipCount > 0 && <span className="text-text-muted">, </span>}
                  {blueChipCount > 0 && <span className="text-accent-green"><span className="num">{blueChipCount}</span> Blue-chip</span>}
                </>
              ) : (
                <span className="text-text-muted">N/A</span>
              )}
            </dd>
          </div>
          <div className="px-3 py-2">
            <dt className="label">Curator</dt>
            <dd className="mt-1 text-sm font-semibold">
              {isKnownCurator ? (
                <Link href={curatorHref!} className="text-text-primary hover:text-accent-blue hover:underline">
                  {curator!.name}
                </Link>
              ) : (
                <span className="text-accent-red">Unknown</span>
              )}
            </dd>
          </div>
        </dl>
      </Panel>

      {/* Collateral & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 items-start">
        {/* Collateral Overview */}
        <Panel
          title="Collateral"
          action={
            collateral.length > 0 ? (
              <span className="flex gap-1">
                <span className={`${tag} border-accent-green-muted text-accent-green`}>
                  {blueChipCount} Blue-chip
                </span>
                {exoticCount > 0 && (
                  <span className={`${tag} border-accent-yellow-muted text-accent-yellow`}>
                    {exoticCount} Exotic
                  </span>
                )}
              </span>
            ) : undefined
          }
        >
          {collateral.length > 0 ? (
            <ul>
              {collateral.map((asset) => (
                <li key={asset.symbol} className="flex items-center justify-between px-3 h-8 border-b border-border-subtle last:border-b-0 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full flex-none ${asset.isBlueChip ? "bg-accent-green" : "bg-accent-yellow"}`}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-text-primary truncate">{asset.symbol}</span>
                    <span className="sr-only">{asset.isBlueChip ? "(blue-chip)" : "(exotic)"}</span>
                  </span>
                  <span className="num text-text-secondary">{asset.allocationPct.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-3 text-sm text-text-tertiary">No collateral data available for this vault.</p>
          )}
        </Panel>

        {/* Recent Alerts */}
        <Panel
          title="Recent alerts"
          meta={alertSummary && alertSummary.total > 0 ? "last 7 days" : undefined}
        >
          {alertSummary && alertSummary.total > 0 ? (
            <>
              <div className="flex gap-1 px-3 py-2 border-b border-border-subtle">
                {alertSummary.critical > 0 && (
                  <span className={`${tag} border-accent-red-muted text-accent-red`}>
                    {alertSummary.critical} Critical
                  </span>
                )}
                {alertSummary.warning > 0 && (
                  <span className={`${tag} border-accent-yellow-muted text-accent-yellow`}>
                    {alertSummary.warning} Warning
                  </span>
                )}
                {alertSummary.info > 0 && (
                  <span className={`${tag} border-border-strong text-text-secondary`}>
                    {alertSummary.info} Info
                  </span>
                )}
              </div>
              <ul>
                {recentAlerts.map((alert) => (
                  <li key={alert.id} className="flex items-start gap-2 px-3 py-1.5 border-b border-border-subtle last:border-b-0 text-sm">
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        alert.severity === "critical"
                          ? "bg-accent-red"
                          : alert.severity === "warning"
                          ? "bg-accent-yellow"
                          : "bg-text-muted"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 text-text-secondary">{alert.title}</span>
                    <span className="num text-xs text-text-muted flex-none mt-0.5">
                      {formatTimeAgo(alert.detectedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex items-center gap-2 p-3 text-sm text-text-tertiary">
              <CheckCircleIcon className="w-4 h-4 text-accent-green flex-shrink-0" />
              <span>No alerts in the last 7 days.</span>
            </div>
          )}
        </Panel>
      </div>

      {/* Methodology Note */}
      <Panel title="Methodology" bodyClassName="p-3">
        <p className="text-xs text-text-tertiary leading-relaxed max-w-[110ch]">
          Strategy classification uses observable on-chain behavior: reallocation frequency, capital efficiency, adapter
          diversification, and collateral selection. Archetypes map to TradFi fund manager categories for
          institutional context. Classification confidence depends on curator identity, alert history, and data consistency.
        </p>
      </Panel>
    </div>
  );
}

// Helpers
function formatLargeNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Skeleton Loading State
function StrategyIntelligenceSkeleton() {
  return (
    <div className="space-y-1.5 animate-pulse">
      <div className="panel">
        <div className="panel-head" />
        <div className="grid grid-cols-3 gap-3 p-3">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-3 w-20 bg-background-elevated/50 mb-2" />
              <div className="h-4 w-24 bg-background-elevated" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
        {[1, 2].map((i) => (
          <div key={i} className="panel">
            <div className="panel-head" />
            <div className="p-3 space-y-2.5">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-3.5 bg-background-elevated/50" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Icons
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

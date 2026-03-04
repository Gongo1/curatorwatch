"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { StrategyClassification } from "@/lib/strategy-classifier";
import { ARCHETYPE_DESCRIPTIONS } from "@/data/curator-strategies";

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
  const [curatorGreenTabs, setCuratorGreenTabs] = useState<number | null>(null);
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

      // Fetch curator risk profile for color coding
      if (data.data.curator?.address) {
        fetchCuratorRating(data.data.curator.address);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategy");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCuratorRating(curatorAddress: string) {
    try {
      const response = await fetch(`/api/curators/${curatorAddress}/rating`);
      const data = await response.json();
      if (data.success && data.data?.factors) {
        // Count "green" tabs: top or above-avg tiers
        const greenCount = data.data.factors.filter(
          (f: { peer: { tier: string } }) => f.peer.tier === "top" || f.peer.tier === "above-avg"
        ).length;
        setCuratorGreenTabs(greenCount);
      }
    } catch {
      // Non-critical, silently ignore
    }
  }

  if (loading) {
    return <StrategyIntelligenceSkeleton />;
  }

  if (error || !strategy) {
    return (
      <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-6 text-center">
        <p className="text-accent-red">{error || "Strategy analysis not available"}</p>
        <button
          onClick={fetchStrategy}
          className="mt-4 text-sm text-accent-red hover:text-accent-red/80 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const archetypeInfo = ARCHETYPE_DESCRIPTIONS[strategy.archetype];
  const isKnownCurator = !!(curator && curator.name);
  const hasCriticalAlerts = (alertSummary?.critical ?? 0) > 0;
  const blueChipCount = collateral.filter((c) => c.isBlueChip).length;
  const exoticCount = collateral.filter((c) => !c.isBlueChip).length;

  // Downgrade confidence if curator is unknown or critical alerts present
  let effectiveConfidence = strategy.confidence;
  if (!isKnownCurator) effectiveConfidence = "low";
  else if (hasCriticalAlerts && effectiveConfidence === "high") effectiveConfidence = "medium";

  const confidenceColors = {
    high: "text-accent-green bg-accent-green/10 border-accent-green/30",
    medium: "text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30",
    low: "text-text-tertiary bg-background-elevated border-border",
  };

  // Curator color based on green tabs (top/above-avg factors out of 7)
  const curatorColor =
    curatorGreenTabs === null
      ? "text-text-primary"
      : curatorGreenTabs >= 5
      ? "text-accent-green"
      : curatorGreenTabs >= 3
      ? "text-accent-yellow"
      : "text-accent-red";

  const curatorHref = isKnownCurator
    ? `/curator/${curatorSlugFromName(curator!.name, curator!.address)}`
    : null;

  return (
    <div className="space-y-6">
      {/* Unknown Curator Warning */}
      {!isKnownCurator && (
        <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangleIcon className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-accent-red text-sm">Unknown Curator — Exercise Caution</p>
            <p className="text-sm text-text-secondary mt-1">
              No profile data available for this vault's curator. Classification confidence has been downgraded.
            </p>
          </div>
        </div>
      )}

      {/* Risk Overview */}
      <div className="bg-background-subtle border border-border rounded-lg p-5">
        <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
          <ShieldIcon className="w-5 h-5 text-accent-blue" />
          Risk Overview
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-text-tertiary mb-1">Recent Alerts (7d)</p>
            {alertSummary && alertSummary.total > 0 ? (
              <div className="flex items-center gap-2">
                {alertSummary.critical > 0 && (
                  <span className="text-sm font-semibold text-accent-red">{alertSummary.critical} Critical</span>
                )}
                {alertSummary.warning > 0 && (
                  <span className="text-sm font-semibold text-accent-yellow">{alertSummary.warning} Warning</span>
                )}
                {alertSummary.info > 0 && (
                  <span className="text-sm font-semibold text-text-secondary">{alertSummary.info} Info</span>
                )}
              </div>
            ) : (
              <span className="text-sm font-semibold text-accent-green">None</span>
            )}
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-1">Collateral Type</p>
            <p className="text-sm font-semibold text-text-primary">
              {collateral.length > 0 ? (
                <>
                  {exoticCount > 0 && <span className="text-accent-yellow">{exoticCount} Exotic</span>}
                  {exoticCount > 0 && blueChipCount > 0 && <span className="text-text-muted">, </span>}
                  {blueChipCount > 0 && <span className="text-accent-green">{blueChipCount} Blue-chip</span>}
                </>
              ) : (
                <span className="text-text-muted">N/A</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-1">Curator</p>
            {isKnownCurator ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={curatorHref!}
                  className={`text-sm font-semibold hover:underline ${curatorColor}`}
                >
                  {curator!.name}
                </Link>
                <Link
                  href={`${curatorHref}#risk-profile`}
                  className="text-xs text-accent-blue hover:underline"
                >
                  View Risk Profile →
                </Link>
              </div>
            ) : (
              <span className="text-sm font-semibold text-accent-red">Unknown</span>
            )}
          </div>
        </div>
      </div>

      {/* Collateral & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Collateral Overview */}
        <div className="bg-background-subtle border border-border rounded-lg p-5">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <ShieldIcon className="w-5 h-5 text-accent-blue" />
            Collateral
          </h3>
          {collateral.length > 0 ? (
            <div className="space-y-3">
              <div className="flex gap-3 mb-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-green/10 text-accent-green border border-accent-green/30">
                  {blueChipCount} Blue-chip
                </span>
                {exoticCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30">
                    {exoticCount} Exotic
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {collateral.map((asset) => (
                  <div key={asset.symbol} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          asset.isBlueChip ? "bg-accent-green" : "bg-accent-yellow"
                        }`}
                      />
                      <span className="font-medium text-text-primary">{asset.symbol}</span>
                    </div>
                    <span className="text-text-tertiary">{asset.allocationPct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">No collateral data available.</p>
          )}
        </div>

        {/* Recent Alerts */}
        <div className="bg-background-subtle border border-border rounded-lg p-5">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-accent-blue" />
            Recent Alerts
            {alertSummary && alertSummary.total > 0 && (
              <span className="ml-auto text-xs font-medium text-text-tertiary">
                Last 7 days
              </span>
            )}
          </h3>
          {alertSummary && alertSummary.total > 0 ? (
            <div className="space-y-3">
              <div className="flex gap-3 mb-3">
                {alertSummary.critical > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-red/10 text-accent-red border border-accent-red/30">
                    {alertSummary.critical} Critical
                  </span>
                )}
                {alertSummary.warning > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30">
                    {alertSummary.warning} Warning
                  </span>
                )}
                {alertSummary.info > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-blue/10 text-accent-blue border border-accent-blue/30">
                    {alertSummary.info} Info
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {recentAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        alert.severity === "critical"
                          ? "bg-accent-red"
                          : alert.severity === "warning"
                          ? "bg-accent-yellow"
                          : "bg-accent-blue"
                      }`}
                    />
                    <div className="min-w-0">
                      <span className="text-text-secondary">{alert.title}</span>
                      <span className="text-text-muted ml-2 text-xs">
                        {formatTimeAgo(alert.detectedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-text-tertiary">
              <CheckCircleIcon className="w-4 h-4 text-accent-green flex-shrink-0" />
              <span>No recent alerts in the last 7 days</span>
            </div>
          )}
        </div>
      </div>

      {/* Strategy Classification */}
      <div className="bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 border border-accent-blue/20 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-text-tertiary mb-2">
              <span>Strategy Classification</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${confidenceColors[effectiveConfidence]}`}>
                {effectiveConfidence} confidence
              </span>
            </div>
            <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3">
              <span className="text-3xl">{archetypeInfo.emoji}</span>
              {strategy.archetype}
            </h2>
            <p className="text-text-secondary mt-1">
              TradFi Analog: <span className="text-text-primary">{strategy.tradFiAnalog}</span>
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-sm text-text-tertiary">Management Style</div>
            <div className="text-lg font-semibold text-text-primary capitalize">
              {strategy.managementStyle}
            </div>
          </div>
        </div>

        <p className="text-text-secondary leading-relaxed">{strategy.description}</p>

        {/* Curator details inline */}
        {isKnownCurator && (
          <div className="mt-4 pt-4 border-t border-accent-blue/20">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm items-center">
              <div>
                <span className="text-text-tertiary">Curator: </span>
                <Link
                  href={curatorHref!}
                  className={`font-medium hover:underline ${curatorColor}`}
                >
                  {curator!.name}
                </Link>
              </div>
              {curator!.entityType && (
                <div>
                  <span className="text-text-tertiary">Entity: </span>
                  <span className="text-text-primary font-medium">{curator!.entityType}</span>
                </div>
              )}
              {curator!.jurisdiction && (
                <div>
                  <span className="text-text-tertiary">Jurisdiction: </span>
                  <span className="text-text-primary font-medium">{curator!.jurisdiction}</span>
                </div>
              )}
              {curator!.foundedYear && (
                <div>
                  <span className="text-text-tertiary">Founded: </span>
                  <span className="text-text-primary font-medium">{curator!.foundedYear}</span>
                </div>
              )}
              {curator!.totalAssetsManaged > 0 && (
                <div>
                  <span className="text-text-tertiary">AUM: </span>
                  <span className="text-text-primary font-medium">${formatLargeNumber(curator!.totalAssetsManaged)}</span>
                </div>
              )}
              {curator!.isRegulated && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-green/10 text-accent-green border border-accent-green/30">
                  Regulated
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Competitive Edge */}
      <div className="bg-background-subtle border border-border rounded-lg p-5">
        <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
          <TargetIcon className="w-5 h-5 text-accent-blue" />
          Competitive Edge
        </h3>
        <ul className="space-y-3">
          {strategy.edge.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <CheckCircleIcon className="w-4 h-4 text-accent-green mt-0.5 flex-shrink-0" />
              <span className="text-text-secondary">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Strengths & Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-background-subtle border border-border rounded-lg p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-accent-green">
            <TrendingUpIcon className="w-5 h-5" />
            Strengths
          </h3>
          <ul className="space-y-2">
            {strategy.strengths.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-accent-green mt-0.5 font-bold">+</span>
                <span className="text-text-secondary">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-background-subtle border border-border rounded-lg p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-accent-yellow">
            <AlertTriangleIcon className="w-5 h-5" />
            Risk Considerations
          </h3>
          <ul className="space-y-2">
            {strategy.risks.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-accent-yellow mt-0.5 font-bold">!</span>
                <span className="text-text-secondary">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Methodology Note */}
      <div className="p-4 rounded-lg bg-background-elevated border border-border-subtle">
        <p className="text-xs text-text-tertiary leading-relaxed">
          <span className="font-medium text-text-secondary">Methodology:</span> Strategy classification based on
          observable on-chain behavior patterns including reallocation frequency, capital efficiency, adapter
          diversification, and collateral selection. Archetypes map to TradFi fund manager categories for
          institutional context. Classification confidence depends on curator identity, alert history, and data consistency.
        </p>
      </div>
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
    <div className="space-y-6 animate-pulse">
      <div className="bg-background-subtle rounded-lg border border-border p-5">
        <div className="h-5 w-32 bg-background-elevated rounded mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-3 w-20 bg-background-elevated/50 rounded mb-2" />
              <div className="h-5 w-24 bg-background-elevated rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-background-subtle rounded-lg border border-border p-5">
            <div className="h-5 w-32 bg-background-elevated rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-4 bg-background-elevated/50 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-background-subtle rounded-xl border border-border p-6">
        <div className="h-4 w-32 bg-background-elevated rounded mb-3" />
        <div className="h-8 w-64 bg-background-elevated rounded mb-2" />
        <div className="h-4 w-48 bg-background-elevated/50 rounded" />
      </div>
    </div>
  );
}

// Icons
function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
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

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

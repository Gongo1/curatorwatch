"use client";

import { useState, useEffect } from "react";
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

interface RiskMetrics {
  smartContract: number;
  oracle: number;
  collateral: number;
  lltv: number;
  operational: number;
}

export function StrategyIntelligence({ vaultAddress, strategy: initialStrategy }: StrategyIntelligenceProps) {
  const [strategy, setStrategy] = useState<StrategyClassification | null>(initialStrategy || null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [curator, setCurator] = useState<CuratorProfile | null>(null);
  const [collateral, setCollateral] = useState<CollateralAsset[]>([]);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [loading, setLoading] = useState(!initialStrategy);
  const [error, setError] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    if (!initialStrategy) {
      fetchStrategy();
    } else {
      // Even with initial strategy, fetch full data for new sections
      fetchStrategy();
    }
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
      setRiskMetrics(data.data.riskMetrics);
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
  const confidenceColors = {
    high: "text-accent-green bg-accent-green/10 border-accent-green/30",
    medium: "text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30",
    low: "text-text-tertiary bg-background-elevated border-border",
  };

  const blueChipCount = collateral.filter((c) => c.isBlueChip).length;
  const exoticCount = collateral.filter((c) => !c.isBlueChip).length;

  return (
    <div className="space-y-6">
      {/* Strategy Header */}
      <div className="bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 border border-accent-blue/20 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-text-tertiary mb-2">
              <span>Strategy Classification</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${confidenceColors[strategy.confidence]}`}>
                {strategy.confidence} confidence
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
      </div>

      {/* Curator Context & Collateral Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Curator Context */}
        <div className="bg-background-subtle border border-border rounded-lg p-5">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-accent-blue" />
            Curator
          </h3>
          {curator && curator.name ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-semibold text-text-primary">{curator.name}</span>
                {curator.isRegulated && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-green/10 text-accent-green border border-accent-green/30">
                    Regulated
                  </span>
                )}
              </div>
              <div className="space-y-2 text-sm">
                {curator.entityType && (
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Entity Type</span>
                    <span className="font-medium text-text-primary">{curator.entityType}</span>
                  </div>
                )}
                {curator.jurisdiction && (
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Jurisdiction</span>
                    <span className="font-medium text-text-primary">{curator.jurisdiction}</span>
                  </div>
                )}
                {curator.foundedYear && (
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Founded</span>
                    <span className="font-medium text-text-primary">{curator.foundedYear}</span>
                  </div>
                )}
                {curator.totalAssetsManaged > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">AUM</span>
                    <span className="font-medium text-text-primary">
                      ${formatLargeNumber(curator.totalAssetsManaged)}
                    </span>
                  </div>
                )}
                {curator.vaultCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Vaults Managed</span>
                    <span className="font-medium text-text-primary">{curator.vaultCount}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangleIcon className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-accent-red text-sm">Unknown Curator</p>
                  <p className="text-sm text-text-secondary mt-1">
                    No profile data available. Exercise caution when depositing into vaults managed by unidentified curators.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

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
      </div>

      {/* Competitive Edge & Recent Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Strengths & Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
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

        {/* Risk Considerations */}
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

      {/* Technical Risk Breakdown (Collapsible) */}
      <div className="bg-background-subtle border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => setShowTechnical(!showTechnical)}
          className="w-full p-5 flex items-center justify-between hover:bg-background-hover transition-colors"
        >
          <span className="font-semibold text-text-primary">Technical Risk Breakdown (Advanced)</span>
          <ChevronIcon className={`w-5 h-5 text-text-tertiary transition-transform ${showTechnical ? "rotate-180" : ""}`} />
        </button>

        {showTechnical && riskMetrics && (
          <div className="px-5 pb-5 pt-0 space-y-4 border-t border-border">
            <p className="text-sm text-text-tertiary pt-4">
              Quantitative risk scores based on observable on-chain behavior:
            </p>
            <RiskMetricBar label="Smart Contract Risk" score={riskMetrics.smartContract} description="Protocol maturity, audits, complexity" />
            <RiskMetricBar label="Oracle Risk" score={riskMetrics.oracle} description="Price feed reliability, manipulation resistance" />
            <RiskMetricBar label="Collateral Risk" score={riskMetrics.collateral} description="Asset quality, concentration, liquidity" />
            <RiskMetricBar label="LLTV Risk" score={riskMetrics.lltv} description="Loan-to-value exposure thresholds" />
            <RiskMetricBar label="Operational Risk" score={riskMetrics.operational} description="Curator reputation, track record" />
          </div>
        )}
      </div>

      {/* Methodology Note */}
      <div className="p-4 rounded-lg bg-background-elevated border border-border-subtle">
        <p className="text-xs text-text-tertiary leading-relaxed">
          <span className="font-medium text-text-secondary">Methodology:</span> Strategy classification based on
          observable on-chain behavior patterns including reallocation frequency, capital efficiency, adapter
          diversification, and collateral selection. Archetypes map to TradFi fund manager categories for
          institutional context. Classification confidence depends on data availability and consistency of behavior.
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

// Risk Metric Bar Component
function RiskMetricBar({
  label,
  score,
  description,
}: {
  label: string;
  score: number;
  description: string;
}) {
  const getScoreColor = (s: number) => {
    if (s >= 70) return "bg-accent-green";
    if (s >= 40) return "bg-accent-yellow";
    return "bg-accent-red";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 70) return "Low";
    if (s >= 40) return "Moderate";
    return "High";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-sm font-medium text-text-primary">{label}</span>
          <span className="text-xs text-text-muted ml-2">({description})</span>
        </div>
        <span className="text-sm font-medium text-text-secondary">
          {getScoreLabel(score)} ({score})
        </span>
      </div>
      <div className="h-2 bg-background-elevated rounded-full overflow-hidden">
        <div
          className={`h-full ${getScoreColor(score)} rounded-full transition-all`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// Skeleton Loading State
function StrategyIntelligenceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-background-subtle rounded-xl border border-border p-6">
        <div className="h-4 w-32 bg-background-elevated rounded mb-3" />
        <div className="h-8 w-64 bg-background-elevated rounded mb-2" />
        <div className="h-4 w-48 bg-background-elevated/50 rounded" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-background-subtle rounded-lg border border-border p-5">
            <div className="h-5 w-24 bg-background-elevated rounded mb-4" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-4 bg-background-elevated/50 rounded" />
              ))}
            </div>
          </div>
        ))}
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/utils/format";

interface VaultInfo {
  name: string;
  symbol: string;
  address: string;
}

interface Alert {
  id: string;
  vaultId: string;
  vault: VaultInfo;
  changeType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  oldValue: string | null;
  newValue: string | null;
  metadata: Record<string, unknown> | null;
  detectedAt: string;
  viewed: boolean;
}

interface AlertSummary {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

interface AlertsResponse {
  success: boolean;
  data: {
    changes: Alert[];
    summary: AlertSummary;
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

const TIME_FILTERS = [
  { value: "24", label: "24h" },
  { value: "168", label: "7d" },
  { value: "720", label: "30d" },
];

const SEVERITY_FILTERS = [
  { value: "", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warnings" },
  { value: "info", label: "Info" },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("24");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    fetchAlerts(true);
  }, [severityFilter, timeFilter]);

  async function fetchAlerts(reset = false) {
    try {
      setLoading(true);
      const newOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        hours: timeFilter,
        limit: "50",
        offset: newOffset.toString(),
        ...(severityFilter && { severity: severityFilter }),
      });

      const response = await fetch(`/api/changes?${params}`);
      const data: AlertsResponse = await response.json();

      if (!data.success) {
        throw new Error("Failed to fetch alerts");
      }

      if (reset) {
        setAlerts(data.data.changes);
        setOffset(50);
      } else {
        setAlerts((prev) => [...prev, ...data.data.changes]);
        setOffset((prev) => prev + 50);
      }

      setSummary(data.data.summary);
      setHasMore(data.data.pagination.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  const getSeverityIcon = (severity: Alert["severity"]) => {
    switch (severity) {
      case "critical":
        return (
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-red/15">
            <svg
              className="w-5 h-5 text-accent-red"
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
          </span>
        );
      case "warning":
        return (
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-yellow/15">
            <svg
              className="w-5 h-5 text-accent-yellow"
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
          </span>
        );
      case "info":
      default:
        return (
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-blue/15">
            <svg
              className="w-5 h-5 text-accent-blue"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </span>
        );
    }
  };

  const getSeverityBadge = (severity: Alert["severity"]) => {
    const classes = {
      critical: "bg-accent-red/15 text-accent-red border border-accent-red/30",
      warning: "bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/30",
      info: "bg-accent-blue/15 text-accent-blue border border-accent-blue/30",
    };

    const labels = {
      critical: "Critical",
      warning: "Warning",
      info: "Info",
    };

    return (
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium ${classes[severity]}`}
      >
        {labels[severity]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background-subtle border-b border-border sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Link href="/" className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center">
                  <span className="text-white font-bold text-lg">C</span>
                </div>
                <span className="text-lg font-semibold text-text-primary">CuratorWatch</span>
              </Link>
              <h1 className="text-xl font-semibold text-text-primary tracking-tight">
                Alerts
              </h1>
              {summary && (
                <p className="mt-1 text-sm text-text-secondary">
                  <span className="text-accent-red font-medium">
                    {summary.critical} critical
                  </span>{" "}
                  <span className="text-text-muted mx-1">•</span>{" "}
                  <span className="text-accent-yellow font-medium">
                    {summary.warning} warnings
                  </span>{" "}
                  <span className="text-text-muted mx-1">•</span>{" "}
                  <span className="text-accent-blue font-medium">
                    {summary.info} info
                  </span>{" "}
                  <span className="text-text-muted ml-2">
                    in last{" "}
                    {timeFilter === "24"
                      ? "24h"
                      : timeFilter === "168"
                        ? "7d"
                        : "30d"}
                  </span>
                </p>
              )}
            </div>

            {/* Summary Cards */}
            {summary && (
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 rounded-lg bg-accent-red/10 border border-accent-red/20">
                  <div className="text-lg font-bold text-accent-red tabular-nums">{summary.critical}</div>
                  <div className="text-xs text-text-tertiary">Critical</div>
                </div>
                <div className="px-4 py-2 rounded-lg bg-accent-yellow/10 border border-accent-yellow/20">
                  <div className="text-lg font-bold text-accent-yellow tabular-nums">{summary.warning}</div>
                  <div className="text-xs text-text-tertiary">Warning</div>
                </div>
                <div className="px-4 py-2 rounded-lg bg-accent-blue/10 border border-accent-blue/20">
                  <div className="text-lg font-bold text-accent-blue tabular-nums">{summary.info}</div>
                  <div className="text-xs text-text-tertiary">Info</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Severity filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary uppercase tracking-wider">Severity</span>
            <div className="flex gap-1">
              {SEVERITY_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setSeverityFilter(filter.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    severityFilter === filter.value
                      ? "bg-accent-blue text-white font-medium"
                      : "bg-background-elevated text-text-secondary hover:bg-background-hover border border-border"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time filter */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-text-tertiary uppercase tracking-wider">Period</span>
            <div className="flex gap-1">
              {TIME_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setTimeFilter(filter.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    timeFilter === filter.value
                      ? "bg-text-primary text-background font-medium"
                      : "bg-background-elevated text-text-secondary hover:bg-background-hover border border-border"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-accent-red-muted/30 border border-accent-red/30 rounded-lg p-6 text-center mb-6">
            <p className="text-accent-red">{error}</p>
            <button
              onClick={() => fetchAlerts(true)}
              className="mt-4 text-sm text-accent-red hover:text-accent-red/80 font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {/* Alerts list */}
        <div className="bg-background-subtle rounded-lg border border-border divide-y divide-border-subtle">
          {loading && alerts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-blue border-t-transparent mx-auto" />
              <p className="mt-4 text-sm text-text-tertiary">Loading alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto">
                <svg
                  className="h-8 w-8 text-accent-green"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium text-text-primary">No alerts</p>
              <p className="text-sm text-text-tertiary mt-1">
                All vaults are operating normally
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-4 p-4 hover:bg-background-hover transition-colors"
              >
                {getSeverityIcon(alert.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/vault/${alert.vault.address}`}
                      className="text-sm font-medium text-accent-blue hover:text-accent-blue-hover transition-colors"
                    >
                      {alert.vault.name}
                    </Link>
                    {getSeverityBadge(alert.severity)}
                    <span className="text-xs text-text-muted font-mono">
                      {alert.vault.address.slice(0, 6)}...{alert.vault.address.slice(-4)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-text-primary mt-1.5">
                    {alert.title}
                  </p>
                  <p className="text-sm text-text-secondary mt-0.5">{alert.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <p className="text-xs text-text-muted">
                      {formatTimeAgo(alert.detectedAt)}
                    </p>
                    {typeof alert.metadata?.txHash === "string" && (
                      <a
                        href={`https://etherscan.io/tx/${alert.metadata.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent-blue hover:text-accent-blue-hover transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Etherscan
                      </a>
                    )}
                  </div>
                </div>
                <Link
                  href={`/vault/${alert.vault.address}`}
                  className="flex items-center gap-1 text-sm text-text-tertiary hover:text-accent-blue transition-colors flex-shrink-0 px-3 py-1.5 rounded-lg hover:bg-background-elevated"
                >
                  View
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ))
          )}
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="text-center mt-6">
            <button
              onClick={() => fetchAlerts(false)}
              disabled={loading}
              className="px-6 py-2.5 text-sm font-medium text-text-primary bg-background-elevated hover:bg-background-hover border border-border rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent-blue border-t-transparent" />
                  Loading...
                </span>
              ) : (
                "Load more alerts"
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/utils/format";

interface Change {
  id: string;
  changeType: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  detectedAt: string;
  metadata: Record<string, unknown> | null;
  vault?: {
    name: string;
    address: string;
  };
}

interface RecentChangesProps {
  vaultAddress?: string;
  limit?: number;
  showVaultName?: boolean;
  compact?: boolean;
}

export function RecentChanges({
  vaultAddress,
  limit = 5,
  showVaultName = false,
  compact = false,
}: RecentChangesProps) {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchChanges();
  }, [vaultAddress]);

  async function fetchChanges() {
    try {
      setLoading(true);
      const url = vaultAddress
        ? `/api/vaults/${vaultAddress}/changes?limit=${limit}&hours=168`
        : `/api/changes?limit=${limit}&hours=24`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        throw new Error("Failed to fetch changes");
      }

      setChanges(data.data.changes);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load changes");
    } finally {
      setLoading(false);
    }
  }

  const isDepositChange = (change: Change) =>
    change.changeType === "LARGE_DEPOSIT" ||
    (change.changeType === "LARGE_FLOW" && change.metadata?.type?.toString().toLowerCase().includes("deposit"));

  const getSeverityDot = (change: Change) => {
    if (isDepositChange(change)) {
      return <span className="w-2 h-2 rounded-full bg-accent-green flex-shrink-0" />;
    }

    const colors = {
      critical: "bg-accent-red",
      warning: "bg-accent-yellow",
      info: "bg-accent-blue",
    };

    return (
      <span
        className={`w-2 h-2 rounded-full ${colors[change.severity]} flex-shrink-0`}
      />
    );
  };

  const getSeverityBadge = (change: Change) => {
    if (isDepositChange(change)) {
      return (
        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-accent-green/15 text-accent-green border border-accent-green/30">
          activity
        </span>
      );
    }

    const classes = {
      critical: "bg-accent-red/15 text-accent-red border border-accent-red/30",
      warning: "bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/30",
      info: "bg-accent-blue/15 text-accent-blue border border-accent-blue/30",
    };

    return (
      <span
        className={`px-1.5 py-0.5 rounded text-xs font-medium ${classes[change.severity]}`}
      >
        {change.severity}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-2 h-2 bg-background-elevated rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-background-elevated rounded w-3/4" />
              <div className="h-3 bg-background-elevated/50 rounded w-1/2 mt-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-text-tertiary text-center py-4">
        Failed to load changes
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto">
          <svg
            className="h-6 w-6 text-accent-green"
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
        <p className="text-sm text-text-secondary mt-3">No recent changes</p>
        <p className="text-xs text-text-muted mt-1">All systems operating normally</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {changes.map((change) => (
          <div key={change.id} className="flex items-center gap-2">
            {getSeverityDot(change)}
            <span className="text-sm text-text-primary truncate flex-1">
              {change.title}
            </span>
            <span className="text-xs text-text-muted flex-shrink-0">
              {formatTimeAgo(change.detectedAt)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border-subtle">
      {changes.map((change) => (
        <div key={change.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start gap-3">
            <div className="mt-1">{getSeverityDot(change)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {showVaultName && change.vault && (
                  <Link
                    href={`/vault/${change.vault.address}`}
                    className="text-xs font-medium text-accent-blue hover:text-accent-blue-hover transition-colors"
                  >
                    {change.vault.name}
                  </Link>
                )}
                {getSeverityBadge(change)}
              </div>
              <p className="text-sm font-medium text-text-primary mt-1">{change.title}</p>
              <p className="text-xs text-text-secondary mt-0.5">{change.description}</p>
              <p className="text-xs text-text-muted mt-1">
                {formatTimeAgo(change.detectedAt)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Change count badge for showing in table rows or headers
 */
export function ChangeCountBadge({
  vaultAddress,
  hours = 24,
}: {
  vaultAddress: string;
  hours?: number;
}) {
  const [counts, setCounts] = useState<{
    critical: number;
    warning: number;
    info: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const response = await fetch(
          `/api/vaults/${vaultAddress}/changes?hours=${hours}&limit=0`
        );
        const data = await response.json();

        if (data.success) {
          setCounts(data.data.summary);
        }
      } catch {
        // Silently fail
      }
    }

    fetchCounts();
  }, [vaultAddress, hours]);

  if (!counts || counts.total === 0) {
    return (
      <span className="text-xs text-text-muted">-</span>
    );
  }

  const hasWarning = counts.critical > 0 || counts.warning > 0;

  return (
    <Link
      href={`/changes?vaultId=${vaultAddress}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
        counts.critical > 0
          ? "bg-accent-red/15 text-accent-red border border-accent-red/30 hover:bg-accent-red/25"
          : counts.warning > 0
            ? "bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/30 hover:bg-accent-yellow/25"
            : "bg-accent-blue/15 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/25"
      }`}
    >
      {hasWarning && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      )}
      {counts.total}
    </Link>
  );
}

"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { formatTimeAgo } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { AlertSubscribeCard } from "@/components/alerts/AlertSubscribeCard";
import { usePortfolio } from "@/hooks/usePortfolio";

interface VaultInfo {
  name: string;
  symbol: string;
  address: string;
  curator?: { name: string | null; id: string } | null;
}

interface CuratorInfo {
  name: string | null;
}

interface Alert {
  id: string;
  scope: "vault" | "curator" | "ecosystem";
  vaultId: string | null;
  vault: VaultInfo | null;
  curatorId: string | null;
  curator: CuratorInfo | null;
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

interface CuratorAlertCount {
  id: string;
  name: string;
  count: number;
}

interface AlertsResponse {
  success: boolean;
  data: {
    changes: Alert[];
    summary: AlertSummary;
    curatorAlertCounts: CuratorAlertCount[];
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

const SCOPE_FILTERS = [
  { value: "all", label: "All Alerts" },
  { value: "vault", label: "Vault" },
  { value: "curator", label: "Curator" },
  { value: "ecosystem", label: "Ecosystem" },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState("critical");
  const [timeFilter, setTimeFilter] = useState("24");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // New state
  const [alertTab, setAlertTab] = useState<"all" | "my">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCurators, setSelectedCurators] = useState<string[]>([]);
  const [curatorAlertCounts, setCuratorAlertCounts] = useState<CuratorAlertCount[]>([]);
  const [curatorDropdownOpen, setCuratorDropdownOpen] = useState(false);
  const [curatorSearch, setCuratorSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { portfolio, untrackVault, untrackCurator, hasTrackedItems } = usePortfolio();

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCuratorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchAlerts(true);
  }, [severityFilter, timeFilter, scopeFilter, alertTab, selectedCurators]);

  const fetchAlerts = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const newOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        hours: timeFilter,
        limit: "50",
        offset: newOffset.toString(),
        scope: scopeFilter,
        ...(severityFilter && { severity: severityFilter }),
      });

      // Multi-curator filter
      if (selectedCurators.length > 0) {
        params.set("curatorIds", selectedCurators.join(","));
      }

      // Portfolio filtering for "My Alerts"
      if (alertTab === "my" && hasTrackedItems) {
        const vaultAddresses = portfolio.trackedVaults.map((v) => v.address);
        const curatorIds = portfolio.trackedCurators.map((c) => c.id);
        if (vaultAddresses.length) params.set("vaultAddresses", vaultAddresses.join(","));
        if (curatorIds.length && !selectedCurators.length) params.set("curatorIds", curatorIds.join(","));
      }

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
      setCuratorAlertCounts(data.data.curatorAlertCounts || []);
      setHasMore(data.data.pagination.hasMore);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [offset, timeFilter, scopeFilter, severityFilter, selectedCurators, alertTab, hasTrackedItems, portfolio]);

  // Client-side search filtering
  const filteredAlerts = useMemo(() => {
    if (!debouncedSearch) return alerts;
    const q = debouncedSearch.toLowerCase();
    return alerts.filter((a) =>
      a.vault?.name?.toLowerCase().includes(q) ||
      a.curator?.name?.toLowerCase().includes(q) ||
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q)
    );
  }, [alerts, debouncedSearch]);

  // Grouped alerts
  const groupedAlerts = useMemo(() => {
    if (viewMode !== "grouped") return null;

    const groups: Record<string, { name: string; alerts: Alert[] }> = {};

    for (const alert of filteredAlerts) {
      let groupKey: string;
      let groupName: string;

      if (alert.scope === "ecosystem") {
        groupKey = "__ecosystem__";
        groupName = "Ecosystem";
      } else if (alert.scope === "curator" && alert.curator?.name) {
        groupKey = alert.curatorId || alert.curator.name;
        groupName = alert.curator.name;
      } else if (alert.scope === "vault" && alert.vault?.curator?.name) {
        groupKey = alert.vault.curator.id || alert.vault.curator.name;
        groupName = alert.vault.curator.name;
      } else if (alert.curator?.name) {
        groupKey = alert.curatorId || alert.curator.name;
        groupName = alert.curator.name;
      } else {
        groupKey = "__uncategorized__";
        groupName = "Other";
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { name: groupName, alerts: [] };
      }
      groups[groupKey].alerts.push(alert);
    }

    return Object.entries(groups)
      .sort((a, b) => b[1].alerts.length - a[1].alerts.length);
  }, [filteredAlerts, viewMode]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Curator dropdown helpers
  const filteredCuratorList = useMemo(() => {
    if (!curatorSearch) return curatorAlertCounts;
    const q = curatorSearch.toLowerCase();
    return curatorAlertCounts.filter((c) => c.name.toLowerCase().includes(q));
  }, [curatorAlertCounts, curatorSearch]);

  const toggleCurator = (id: string) => {
    setSelectedCurators((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const curatorButtonLabel = useMemo(() => {
    if (selectedCurators.length === 0) return "All Curators";
    if (selectedCurators.length <= 2) {
      return selectedCurators
        .map((id) => curatorAlertCounts.find((c) => c.id === id)?.name ?? id)
        .join(", ");
    }
    return `${selectedCurators.length} curators selected`;
  }, [selectedCurators, curatorAlertCounts]);

  const isDepositAlert = (alert: Alert) =>
    alert.changeType === "LARGE_DEPOSIT" ||
    (alert.changeType === "LARGE_FLOW" && alert.metadata?.type?.toString().toLowerCase().includes("deposit"));

  const isSurgeAlert = (alert: Alert) =>
    alert.changeType === "VAULT_TVL_SURGE" || alert.changeType === "CURATOR_AUM_SURGE";

  const getSeverityIcon = (alert: Alert) => {
    if (isDepositAlert(alert) || isSurgeAlert(alert)) {
      return (
        <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-green/15">
          <svg className="w-5 h-5 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </span>
      );
    }

    if (alert.scope === "ecosystem") {
      return (
        <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-red/15">
          <svg className="w-5 h-5 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      );
    }

    switch (alert.severity) {
      case "critical":
        return (
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-red/15">
            <svg className="w-5 h-5 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
        );
      case "warning":
        return (
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-yellow/15">
            <svg className="w-5 h-5 text-accent-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
        );
      case "info":
      default:
        return (
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-blue/15">
            <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
        );
    }
  };

  const getSeverityBadge = (alert: Alert) => {
    if (isDepositAlert(alert) || isSurgeAlert(alert)) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-accent-green/15 text-accent-green border border-accent-green/30">
          Activity
        </span>
      );
    }

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
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${classes[alert.severity]}`}>
        {labels[alert.severity]}
      </span>
    );
  };

  const getScopeBadge = (alert: Alert) => {
    if (alert.scope === "curator") {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30">
          Curator
        </span>
      );
    }
    if (alert.scope === "ecosystem") {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">
          Ecosystem
        </span>
      );
    }
    return null;
  };

  const getAlertName = (alert: Alert): string => {
    if (alert.scope === "vault" && alert.vault) {
      return alert.vault.name;
    }
    if (alert.scope === "curator" && alert.curator?.name) {
      return alert.curator.name;
    }
    if (alert.scope === "ecosystem") {
      return "Ecosystem";
    }
    return "Unknown";
  };

  const getAlertSubtext = (alert: Alert): string | null => {
    if (alert.scope === "vault" && alert.vault?.address) {
      return `${alert.vault.address.slice(0, 6)}...${alert.vault.address.slice(-4)}`;
    }
    return null;
  };

  const renderAlertCard = (alert: Alert) => (
    <div
      key={alert.id}
      className="flex items-start gap-4 p-4 hover:bg-background-hover transition-colors"
    >
      {getSeverityIcon(alert)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-accent-blue">
            {getAlertName(alert)}
          </span>
          {getSeverityBadge(alert)}
          {getScopeBadge(alert)}
          {getAlertSubtext(alert) && (
            <span className="text-xs text-text-muted font-mono">
              {getAlertSubtext(alert)}
            </span>
          )}
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
    </div>
  );

  return (
    <>
      <PageHeader
        title="Alerts"
        description={summary ? `${summary.critical} critical \u2022 ${summary.warning} warnings \u2022 ${summary.info} info` : undefined}
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Alerts" }]}
      />

      <AlertSubscribeCard />

      {/* My Alerts / All Alerts Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => { setAlertTab("my"); setSelectedCurators([]); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            alertTab === "my"
              ? "bg-accent-blue text-white"
              : "bg-background-elevated text-text-secondary hover:bg-background-hover border border-border"
          }`}
        >
          My Alerts
        </button>
        <button
          onClick={() => { setAlertTab("all"); }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            alertTab === "all"
              ? "bg-accent-blue text-white"
              : "bg-background-elevated text-text-secondary hover:bg-background-hover border border-border"
          }`}
        >
          All Alerts
        </button>
      </div>

      {/* Portfolio Summary (My Alerts tab) */}
      {alertTab === "my" && hasTrackedItems && (
        <div className="bg-background-elevated border border-border rounded-lg p-4 mb-6">
          <p className="text-sm text-text-secondary mb-3">
            Your Portfolio: {portfolio.trackedVaults.length} vault{portfolio.trackedVaults.length !== 1 ? "s" : ""}, {portfolio.trackedCurators.length} curator{portfolio.trackedCurators.length !== 1 ? "s" : ""} tracked
          </p>
          <div className="flex flex-wrap gap-2">
            {portfolio.trackedVaults.map((v) => (
              <span key={v.address} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-accent-blue/10 border border-accent-blue/20 text-accent-blue">
                {v.name}
                <button
                  onClick={() => untrackVault(v.address)}
                  className="hover:text-accent-red transition-colors"
                  title="Untrack"
                >
                  &times;
                </button>
              </span>
            ))}
            {portfolio.trackedCurators.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/10 border border-purple-500/20 text-purple-400">
                {c.name}
                <button
                  onClick={() => untrackCurator(c.id)}
                  className="hover:text-accent-red transition-colors"
                  title="Untrack"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty portfolio state */}
      {alertTab === "my" && !hasTrackedItems && (
        <div className="bg-background-elevated border border-border rounded-lg p-8 text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-accent-blue/10 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-primary">No tracked items</p>
          <p className="text-sm text-text-tertiary mt-1">
            Track vaults and curators to see personalized alerts here
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="flex items-center gap-3 mb-6">
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

      {/* How Alerts Work - Explanation */}
      <div className="bg-background-elevated border border-border rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold text-text-primary mb-3">How Alerts Work</h2>
        <p className="text-sm text-text-secondary mb-4">
          CuratorWatch monitors vaults, curators, and the entire ecosystem for statistically
          significant events—changes that happen less than 5% of the time.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-background-subtle border border-border-subtle">
            <h3 className="font-medium text-accent-blue text-sm mb-1.5">APY Changes</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Alerts when APY deviates &gt;20% from 7-day average. Only 5% of daily APY
              changes exceed this threshold.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-background-subtle border border-border-subtle">
            <h3 className="font-medium text-accent-green text-sm mb-1.5">Capital Flows</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Deposits (green) and withdrawals (red/orange) exceeding 10% of vault TVL.
              Deposits signal growth; large withdrawals may need attention.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-background-subtle border border-border-subtle">
            <h3 className="font-medium text-accent-red text-sm mb-1.5">TVL Drops</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Alerts when a vault&apos;s TVL drops &gt;10% in 24h via snapshot comparison.
              Catches distributed outflows that individual transaction alerts miss.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-background-subtle border border-border-subtle">
            <h3 className="font-medium text-accent-red text-sm mb-1.5">Curator AUM</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Alerts when a curator&apos;s total AUM drops &gt;5% in 24h or &gt;15% over 3 days.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-background-subtle border border-border-subtle">
            <h3 className="font-medium text-accent-red text-sm mb-1.5">Ecosystem AUM</h3>
            <p className="text-xs text-text-tertiary leading-relaxed">
              Alerts when total platform AUM drops &gt;3% in 24h. Indicates broad-based outflows.
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search alerts by vault, curator, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-background-elevated border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Curator dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary uppercase tracking-wider">Curator</span>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setCuratorDropdownOpen((prev) => !prev)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors inline-flex items-center gap-1.5 ${
                selectedCurators.length > 0
                  ? "bg-accent-blue text-white font-medium"
                  : "bg-background-elevated text-text-secondary hover:bg-background-hover border border-border"
              }`}
            >
              <span className="max-w-[200px] truncate">{curatorButtonLabel}</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${curatorDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {curatorDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-background-elevated border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                {/* Search within dropdown */}
                <div className="p-2 border-b border-border">
                  <input
                    type="text"
                    placeholder="Search curators..."
                    value={curatorSearch}
                    onChange={(e) => setCuratorSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-background-subtle border border-border rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue/50 transition-colors"
                    autoFocus
                  />
                </div>

                {/* "All Curators" reset option */}
                <button
                  onClick={() => { setSelectedCurators([]); setCuratorDropdownOpen(false); setCuratorSearch(""); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
                    selectedCurators.length === 0
                      ? "bg-accent-blue/10 text-accent-blue font-medium"
                      : "text-text-secondary hover:bg-background-hover"
                  }`}
                >
                  All Curators
                  {selectedCurators.length === 0 && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Curator list with checkboxes */}
                <div className="max-h-64 overflow-y-auto border-t border-border-subtle">
                  {filteredCuratorList.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-text-muted text-center">
                      {curatorAlertCounts.length === 0 ? "No curator alerts in this period" : "No curators match search"}
                    </div>
                  ) : (
                    filteredCuratorList.map((curator) => (
                      <button
                        key={curator.id}
                        onClick={() => toggleCurator(curator.id)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-background-hover transition-colors flex items-center gap-3"
                      >
                        <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                          selectedCurators.includes(curator.id)
                            ? "bg-accent-blue border-accent-blue"
                            : "border-border"
                        }`}>
                          {selectedCurators.includes(curator.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className="flex-1 text-text-primary truncate">{curator.name}</span>
                        <span className="flex-shrink-0 text-xs text-text-muted tabular-nums">{curator.count}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scope filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary uppercase tracking-wider">Scope</span>
          <div className="flex gap-1">
            {SCOPE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setScopeFilter(filter.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  scopeFilter === filter.value
                    ? "bg-accent-blue text-white font-medium"
                    : "bg-background-elevated text-text-secondary hover:bg-background-hover border border-border"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

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

        {/* Time filter + View mode toggle */}
        <div className="flex items-center gap-4 ml-auto">
          {/* View mode */}
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                viewMode === "list"
                  ? "bg-text-primary text-background font-medium"
                  : "bg-background-elevated text-text-secondary hover:bg-background-hover border border-border"
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("grouped")}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                viewMode === "grouped"
                  ? "bg-text-primary text-background font-medium"
                  : "bg-background-elevated text-text-secondary hover:bg-background-hover border border-border"
              }`}
            >
              Grouped
            </button>
          </div>

          <div className="flex items-center gap-2">
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
      {viewMode === "grouped" && groupedAlerts ? (
        <div className="space-y-4">
          {groupedAlerts.map(([key, group]) => (
            <div key={key} className="bg-background-subtle rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => toggleGroup(key)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-background-hover transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-text-muted transition-transform ${collapsedGroups.has(key) ? "" : "rotate-90"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-semibold text-text-primary">{group.name}</span>
                  <span className="text-xs text-text-muted">({group.alerts.length} alert{group.alerts.length !== 1 ? "s" : ""})</span>
                </div>
              </button>
              {!collapsedGroups.has(key) && (
                <div className="divide-y divide-border-subtle border-t border-border-subtle">
                  {group.alerts.map(renderAlertCard)}
                </div>
              )}
            </div>
          ))}
          {groupedAlerts.length === 0 && !loading && (
            <div className="bg-background-subtle rounded-lg border border-border p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto">
                <svg className="h-8 w-8 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium text-text-primary">No alerts</p>
              <p className="text-sm text-text-tertiary mt-1">All vaults are operating normally</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-background-subtle rounded-lg border border-border divide-y divide-border-subtle">
          {loading && alerts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent-blue border-t-transparent mx-auto" />
              <p className="mt-4 text-sm text-text-tertiary">Loading alerts...</p>
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto">
                <svg className="h-8 w-8 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium text-text-primary">No alerts</p>
              <p className="text-sm text-text-tertiary mt-1">
                {debouncedSearch ? "No alerts match your search" : "All vaults are operating normally"}
              </p>
            </div>
          ) : (
            filteredAlerts.map(renderAlertCard)
          )}
        </div>
      )}

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
    </>
  );
}

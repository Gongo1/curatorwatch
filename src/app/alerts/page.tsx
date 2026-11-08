"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { formatTimeAgo } from "@/lib/utils/format";
import { Check, ChevronDown, ChevronRight, ExternalLink, Search, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";
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


  // Severity tag: the row's left column. Deposits and surges read as activity
  // (green); otherwise the severity sets the color.
  const getSeverityTag = (alert: Alert) => {
    if (isDepositAlert(alert) || isSurgeAlert(alert)) {
      return <SevTag className="up border-accent-green-muted">Activity</SevTag>;
    }

    const classes = {
      critical: "down border-accent-red-muted",
      warning: "text-accent-yellow border-accent-yellow-muted",
      info: "text-text-secondary border-border-strong",
    };

    const labels = {
      critical: "Critical",
      warning: "Warning",
      info: "Info",
    };

    return <SevTag className={classes[alert.severity]}>{labels[alert.severity]}</SevTag>;
  };

  const getScopeBadge = (alert: Alert) => {
    if (alert.scope === "curator") {
      return <span className="label px-1 border border-border-strong text-text-secondary">Curator</span>;
    }
    if (alert.scope === "ecosystem") {
      return <span className="label px-1 border border-border-strong text-text-secondary">Ecosystem</span>;
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
      className="flex items-start gap-3 px-3 py-2 border-b border-border-subtle last:border-0 hover:bg-background-hover transition-colors"
    >
      {getSeverityTag(alert)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text-primary">
            {getAlertName(alert)}
          </span>
          {getScopeBadge(alert)}
          {getAlertSubtext(alert) && (
            <span className="num text-xs text-text-muted">
              {getAlertSubtext(alert)}
            </span>
          )}
          <span className="num text-xs text-text-tertiary ml-auto whitespace-nowrap">
            {formatTimeAgo(alert.detectedAt)}
          </span>
        </div>
        <p className="text-sm text-text-primary mt-1">
          {alert.title}
        </p>
        <p className="text-sm text-text-secondary mt-0.5">{alert.description}</p>
        {typeof alert.metadata?.txHash === "string" && (
          <a
            href={`https://etherscan.io/tx/${alert.metadata.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs text-accent-blue hover:underline"
          >
            Etherscan
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );

  const emptyState = (
    <div className="px-3 py-8 text-center">
      <p className="text-sm text-text-primary">No alerts for these filters.</p>
      <p className="text-sm text-text-tertiary mt-1">
        {debouncedSearch
          ? "No alert matches your search. Clear the search or widen the period."
          : "Nothing crossed the alert thresholds. Widen the period or set severity to All."}
      </p>
    </div>
  );

  const loadingState = (
    <div className="animate-pulse" aria-label="Loading alerts">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 h-12 border-b border-border-subtle last:border-0">
          <div className="h-4 w-16 bg-background-elevated" />
          <div className="h-3 w-48 bg-background-elevated" />
          <div className="h-3 w-12 bg-background-elevated ml-auto" />
        </div>
      ))}
      <p className="sr-only">Loading alerts…</p>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Alerts"
        description={summary ? `${summary.critical} critical · ${summary.warning} warnings · ${summary.info} info` : undefined}
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Alerts" }]}
      />

      <div className="space-y-1.5">
        <AlertSubscribeCard />

        {/* Summary */}
        {summary && (
          <section aria-label="Alert counts" className="panel">
            <dl className="grid grid-cols-3">
              <Count k="Critical" v={summary.critical} className="down" />
              <Count k="Warning" v={summary.warning} className="text-accent-yellow" />
              <Count k="Info" v={summary.info} className="text-text-primary" />
            </dl>
          </section>
        )}

        <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
          <Panel
            title={alertTab === "my" ? "My alerts" : "All alerts"}
            meta={`${filteredAlerts.length} shown`}
          >
            {/* Toolbar: tab, search, view */}
            <div className="flex gap-2 items-center px-2 py-1.5 border-b border-border flex-wrap">
              <div role="group" aria-label="Alert set" className="flex border border-border-strong">
                <button
                  type="button"
                  aria-pressed={alertTab === "my"}
                  onClick={() => { setAlertTab("my"); setSelectedCurators([]); }}
                  className={`${SEG_BTN} ${alertTab === "my" ? SEG_ON : SEG_OFF}`}
                >
                  My Alerts
                </button>
                <button
                  type="button"
                  aria-pressed={alertTab === "all"}
                  onClick={() => { setAlertTab("all"); }}
                  className={`${SEG_BTN} ${alertTab === "all" ? SEG_ON : SEG_OFF}`}
                >
                  All Alerts
                </button>
              </div>

              <div className="relative flex-1 min-w-[12rem]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  aria-label="Search alerts"
                  placeholder="Search by vault, curator, or keyword"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="field h-7 pl-7 pr-7 text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div role="group" aria-label="View" className="flex border border-border-strong">
                <button
                  type="button"
                  aria-pressed={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                  className={`${SEG_BTN} ${viewMode === "list" ? SEG_ON : SEG_OFF}`}
                >
                  List
                </button>
                <button
                  type="button"
                  aria-pressed={viewMode === "grouped"}
                  onClick={() => setViewMode("grouped")}
                  className={`${SEG_BTN} ${viewMode === "grouped" ? SEG_ON : SEG_OFF}`}
                >
                  Grouped
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-2 py-1.5 border-b border-border bg-background">
              {/* Curator dropdown */}
              <div className="flex items-center gap-2">
                <span className="label">Curator</span>
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    aria-expanded={curatorDropdownOpen}
                    aria-haspopup="listbox"
                    onClick={() => setCuratorDropdownOpen((prev) => !prev)}
                    className={`h-[1.625rem] px-2.5 text-sm border inline-flex items-center gap-1.5 transition-colors ${
                      selectedCurators.length > 0
                        ? "bg-accent-blue border-accent-blue text-signal-ink font-medium"
                        : "border-border-strong text-text-secondary hover:text-text-primary hover:bg-background-hover"
                    }`}
                  >
                    <span className="max-w-[200px] truncate">{curatorButtonLabel}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${curatorDropdownOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>

                  {curatorDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-72 max-w-[calc(100vw-2rem)] bg-background-elevated border border-border-strong z-50 overflow-hidden">
                      {/* Search within dropdown */}
                      <div className="p-1.5 border-b border-border">
                        <input
                          type="text"
                          aria-label="Search curators"
                          placeholder="Search curators…"
                          value={curatorSearch}
                          onChange={(e) => setCuratorSearch(e.target.value)}
                          className="field h-7 text-sm"
                          autoFocus
                        />
                      </div>

                      {/* "All Curators" reset option */}
                      <button
                        type="button"
                        onClick={() => { setSelectedCurators([]); setCuratorDropdownOpen(false); setCuratorSearch(""); }}
                        className={`w-full text-left px-3 h-8 text-sm transition-colors flex items-center justify-between ${
                          selectedCurators.length === 0
                            ? "text-accent-blue font-medium"
                            : "text-text-secondary hover:bg-background-hover"
                        }`}
                      >
                        All Curators
                        {selectedCurators.length === 0 && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                      </button>

                      {/* Curator list with checkboxes */}
                      <div className="max-h-64 overflow-y-auto border-t border-border-subtle">
                        {filteredCuratorList.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-text-tertiary text-center">
                            {curatorAlertCounts.length === 0 ? "No curator alerts in this period" : "No curators match search"}
                          </div>
                        ) : (
                          filteredCuratorList.map((curator) => {
                            const on = selectedCurators.includes(curator.id);
                            return (
                              <button
                                key={curator.id}
                                type="button"
                                role="checkbox"
                                aria-checked={on}
                                onClick={() => toggleCurator(curator.id)}
                                className="w-full text-left px-3 h-8 text-sm hover:bg-background-hover transition-colors flex items-center gap-2.5"
                              >
                                <span className={`flex-shrink-0 w-3.5 h-3.5 border flex items-center justify-center ${
                                  on ? "bg-accent-blue border-accent-blue" : "border-border-strong"
                                }`}>
                                  {on && <Check className="w-3 h-3 text-signal-ink" strokeWidth={3} aria-hidden="true" />}
                                </span>
                                <span className="flex-1 text-text-primary truncate">{curator.name}</span>
                                <span className="flex-shrink-0 num text-xs text-text-tertiary">{curator.count}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <FilterGroup label="Scope" options={SCOPE_FILTERS} value={scopeFilter} onChange={setScopeFilter} />
              <FilterGroup label="Severity" options={SEVERITY_FILTERS} value={severityFilter} onChange={setSeverityFilter} />
              <FilterGroup label="Period" options={TIME_FILTERS} value={timeFilter} onChange={setTimeFilter} num />
            </div>

            {/* Portfolio Summary (My Alerts tab) */}
            {alertTab === "my" && hasTrackedItems && (
              <div className="px-3 py-2 border-b border-border">
                <p className="label mb-1.5">
                  Tracked: <span className="num">{portfolio.trackedVaults.length}</span> vault{portfolio.trackedVaults.length !== 1 ? "s" : ""},{" "}
                  <span className="num">{portfolio.trackedCurators.length}</span> curator{portfolio.trackedCurators.length !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {portfolio.trackedVaults.map((v) => (
                    <span key={v.address} className="inline-flex items-center gap-1.5 h-6 px-2 text-xs border border-border-strong text-text-primary">
                      {v.name}
                      <button
                        type="button"
                        onClick={() => untrackVault(v.address)}
                        className="text-text-tertiary hover:text-accent-red transition-colors"
                        title="Untrack"
                        aria-label={`Untrack ${v.name}`}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  {portfolio.trackedCurators.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1.5 h-6 px-2 text-xs border border-border-strong text-text-primary">
                      <span className="label text-accent-blue">CUR</span>
                      {c.name}
                      <button
                        type="button"
                        onClick={() => untrackCurator(c.id)}
                        className="text-text-tertiary hover:text-accent-red transition-colors"
                        title="Untrack"
                        aria-label={`Untrack ${c.name}`}
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
              <div className="px-3 py-3 border-b border-border">
                <p className="text-sm text-text-primary">No tracked items.</p>
                <p className="text-sm text-text-tertiary mt-0.5">
                  Track vaults and curators to see their alerts here.
                </p>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="px-3 py-3 border-b border-border flex items-center gap-3 flex-wrap">
                <p className="text-sm text-accent-red flex-1 min-w-0">
                  Alerts did not load ({error}). Check your connection, then try again.
                </p>
                <button type="button" onClick={() => fetchAlerts(true)} className="btn btn-ghost">
                  Try again
                </button>
              </div>
            )}

            {/* Alerts list */}
            {viewMode === "grouped" && groupedAlerts ? (
              <div>
                {loading && alerts.length === 0 ? (
                  loadingState
                ) : (
                  groupedAlerts.map(([key, group]) => {
                    const collapsed = collapsedGroups.has(key);
                    return (
                      <div key={key} className="border-b border-border last:border-0">
                        <button
                          type="button"
                          aria-expanded={!collapsed}
                          onClick={() => toggleGroup(key)}
                          className="w-full flex items-center gap-2 px-3 h-8 bg-background hover:bg-background-hover transition-colors"
                        >
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-text-tertiary transition-transform ${collapsed ? "" : "rotate-90"}`}
                            aria-hidden="true"
                          />
                          <span className="text-sm font-semibold text-text-primary truncate">{group.name}</span>
                          <span className="num text-xs text-text-tertiary ml-auto">
                            {group.alerts.length} alert{group.alerts.length !== 1 ? "s" : ""}
                          </span>
                        </button>
                        {!collapsed && (
                          <div className="border-t border-border-subtle">
                            {group.alerts.map(renderAlertCard)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {groupedAlerts.length === 0 && !loading && emptyState}
              </div>
            ) : (
              <div>
                {loading && alerts.length === 0
                  ? loadingState
                  : filteredAlerts.length === 0
                    ? emptyState
                    : filteredAlerts.map(renderAlertCard)}
              </div>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="text-center px-3 py-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => fetchAlerts(false)}
                  disabled={loading}
                  className="btn btn-ghost"
                >
                  {loading ? "Loading…" : "Load more alerts"}
                </button>
              </div>
            )}
          </Panel>

          {/* How Alerts Work - Explanation */}
          <Panel title="How alerts work" bodyClassName="text-sm">
            <p className="px-3 py-2.5 text-text-secondary">
              CuratorWatch monitors vaults, curators, and the entire ecosystem for statistically
              significant events: changes that happen less than 5% of the time.
            </p>
            <dl>
              {[
                {
                  k: "APY changes",
                  v: "Alerts when APY deviates >20% from the 7-day average. Only 5% of daily APY changes exceed this threshold.",
                },
                {
                  k: "Capital flows",
                  v: "Deposits (green) and withdrawals (red or yellow) above 10% of vault TVL. Deposits signal growth; large withdrawals may need attention.",
                },
                {
                  k: "TVL drops",
                  v: "Alerts when a vault's TVL drops >10% in 24h via snapshot comparison. Catches distributed outflows that individual transaction alerts miss.",
                },
                {
                  k: "Curator AUM",
                  v: "Alerts when a curator's total AUM drops >5% in 24h or >15% over 3 days.",
                },
                {
                  k: "Ecosystem AUM",
                  v: "Alerts when total platform AUM drops >3% in 24h. Indicates broad-based outflows.",
                },
              ].map((row) => (
                <div key={row.k} className="px-3 py-2 border-t border-border-subtle">
                  <dt className="label text-text-primary">{row.k}</dt>
                  <dd className="text-xs text-text-secondary leading-relaxed mt-1">{row.v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}

// Segmented control (hairline group, active = amber fill) — copies CuratorIndex.
const SEG_BTN =
  "h-[1.625rem] px-2.5 cond text-[0.75rem] font-semibold uppercase tracking-[0.04em] border-r border-border-strong last:border-r-0 transition-colors";
const SEG_ON = "bg-accent-blue text-signal-ink";
const SEG_OFF = "text-text-secondary hover:text-text-primary hover:bg-background-hover";

function FilterGroup({
  label,
  options,
  value,
  onChange,
  num = false,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  num?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="label">{label}</span>
      <div role="group" aria-label={label} className="flex border border-border-strong">
        {options.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={value === filter.value}
            onClick={() => onChange(filter.value)}
            className={`${SEG_BTN} ${num ? "num normal-case" : ""} ${value === filter.value ? SEG_ON : SEG_OFF}`}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SevTag({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`label flex-none w-[4.25rem] text-center py-0.5 mt-0.5 border ${className}`}>
      {children}
    </span>
  );
}

function Count({ k, v, className }: { k: string; v: number; className: string }) {
  return (
    <div className="px-3 py-2.5 border-r border-border last:border-r-0 min-w-0">
      <dt className="label">{k}</dt>
      <dd className={`num font-semibold text-[1.45rem] leading-none mt-1.5 ${v === 0 ? "text-text-muted" : className}`}>{v}</dd>
    </div>
  );
}

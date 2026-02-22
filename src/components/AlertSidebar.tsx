"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatTimeAgo } from "@/lib/utils/format";

interface AlertItem {
  id: string;
  type: "apy_change" | "large_flow" | "concentration" | "lifecycle";
  severity: "critical" | "warning" | "info";
  title: string;
  value?: string;
  curatorName?: string;
  vaultName?: string;
  timestamp: string;
}

interface ChangesResponse {
  success: boolean;
  data: {
    changes: Array<{
      id: string;
      changeType: string;
      severity: string;
      title: string;
      oldValue: string | null;
      newValue: string | null;
      metadata: Record<string, unknown> | null;
      detectedAt: string;
      vault: {
        name: string;
        symbol: string;
        address: string;
        curator?: {
          name: string | null;
        } | null;
      };
    }>;
  };
}

function isDepositChange(change: ChangesResponse["data"]["changes"][0]) {
  return (
    change.changeType === "LARGE_DEPOSIT" ||
    (change.changeType === "LARGE_FLOW" && change.metadata?.type?.toString().toLowerCase().includes("deposit"))
  );
}

function getSeverityColor(severity: string, change?: ChangesResponse["data"]["changes"][0]) {
  if (change && isDepositChange(change)) return "text-green-400";
  switch (severity) {
    case "critical":
      return "text-red-400";
    case "warning":
      return "text-yellow-400";
    default:
      return "text-blue-400";
  }
}

function getSeverityDot(severity: string, change?: ChangesResponse["data"]["changes"][0]) {
  if (change && isDepositChange(change)) return "bg-green-500";
  switch (severity) {
    case "critical":
      return "bg-red-500";
    case "warning":
      return "bg-yellow-500";
    default:
      return "bg-blue-500";
  }
}

function getAlertIcon(type: string) {
  switch (type) {
    case "apy_change":
      return "↕";
    case "large_flow":
      return "◈";
    case "concentration":
      return "◉";
    case "lifecycle":
      return "★";
    default:
      return "•";
  }
}

function formatAlertTitle(change: ChangesResponse["data"]["changes"][0]): string {
  switch (change.changeType) {
    case "APY_CHANGE":
      return "APY";
    case "LARGE_DEPOSIT":
      return "IN";
    case "LARGE_WITHDRAWAL":
      return "OUT";
    case "LARGE_FLOW":
      return isDepositChange(change) ? "IN" : "OUT";
    case "CONCENTRATION_CHANGE":
    case "CONCENTRATION_SPIKE":
      return "CONC";
    case "NEW_VAULT":
    case "VAULT_LAUNCH":
      return "NEW";
    case "VAULT_SHUTDOWN":
      return "END";
    default:
      return change.changeType.slice(0, 4);
  }
}

export function AlertSidebar() {
  const [alerts, setAlerts] = useState<ChangesResponse["data"]["changes"]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const response = await fetch("/api/changes?hours=72&limit=20");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data: ChangesResponse = await response.json();
        if (data.success) {
          setAlerts(data.data.changes);
        }
      } catch (err) {
        // Silently fail - alerts sidebar is non-critical
        if (process.env.NODE_ENV === "development") {
          console.warn("AlertSidebar: Failed to fetch alerts", err);
        }
      } finally {
        setLoading(false);
      }
    }

    // Delay initial fetch to allow dev server to be ready
    const initialDelay = setTimeout(fetchAlerts, 500);
    const interval = setInterval(fetchAlerts, 60000); // Refresh every minute
    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, []);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="hidden xl:block fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-[#1a1a1a] border-l border-t border-b border-[#333] rounded-l-lg px-1 py-4 hover:bg-[#252525] transition-colors"
        title="Show alerts"
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-yellow-400 font-mono">◀</span>
          <span className="text-[9px] text-gray-500 font-mono tracking-tighter" style={{ writingMode: "vertical-rl" }}>
            ALERTS
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="hidden xl:flex fixed right-0 top-16 bottom-0 w-48 bg-[#0d0d0d] border-l border-[#252525] z-40 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#252525] bg-[#111]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-mono text-gray-400 tracking-wider">ALERTS</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-gray-600 hover:text-gray-400 transition-colors"
          title="Collapse"
        >
          <span className="text-[10px] font-mono">▶</span>
        </button>
      </div>

      {/* Alert Feed */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="p-2 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-2 w-12 bg-[#252525] rounded mb-1" />
                <div className="h-3 w-full bg-[#1a1a1a] rounded" />
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-3 text-center">
            <span className="text-[10px] text-gray-600 font-mono">NO ALERTS</span>
          </div>
        ) : (
          <div className="divide-y divide-[#1a1a1a]">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                href={`/vault/${alert.vault?.address || ""}`}
                className="block px-2 py-1.5 hover:bg-[#151515] transition-colors group"
              >
                {/* Time + Type */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-mono text-gray-600">
                    {formatTimeAgo(new Date(alert.detectedAt))}
                  </span>
                  <span className={`text-[9px] font-mono font-bold ${getSeverityColor(alert.severity, alert)}`}>
                    {formatAlertTitle(alert)}
                  </span>
                </div>

                {/* Content */}
                <div className="flex items-start gap-1">
                  <span className={`w-1 h-1 rounded-full mt-1 flex-shrink-0 ${getSeverityDot(alert.severity, alert)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-gray-300 font-mono truncate leading-tight">
                      {alert.vault?.symbol || alert.vault?.name?.slice(0, 12)}
                    </div>
                    <div className="text-[9px] text-gray-500 font-mono truncate">
                      {alert.title?.slice(0, 20) || "Alert"}
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold flex-shrink-0 ${getSeverityColor(alert.severity, alert)}`}>
                    {alert.newValue || ""}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-[#252525] px-2 py-1.5 bg-[#111]">
        <Link
          href="/alerts"
          className="flex items-center justify-center gap-1 text-[9px] font-mono text-gray-500 hover:text-gray-300 transition-colors"
        >
          <span>VIEW ALL</span>
          <span>→</span>
        </Link>
      </div>

      {/* Bloomberg-style ticker line */}
      <div className="h-0.5 bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600" />
    </div>
  );
}

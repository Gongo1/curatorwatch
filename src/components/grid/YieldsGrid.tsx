"use client";

import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "./DataGrid";
import { formatCurrency } from "@/lib/utils/format";

// Re-export for use by the yields page - these are thin wrappers
// The yields page has 4 different table views with complex expandable rows.
// Since AG Grid CE doesn't support Master/Detail, the yields page will use
// DataGrid directly with its own column definitions.

interface VaultYieldRow {
  vaultId: string;
  vaultAddress: string;
  vaultName: string;
  assetSymbol: string;
  curatorName: string | null;
  tvl: number;
  grossApy: number;
  netApy: number;
  performanceFee: number;
  dailyYield: number;
  weeklyYield: number;
  monthlyYield: number;
  annualizedYield: number;
}

interface VaultYieldsGridProps {
  vaults: VaultYieldRow[];
  timeFrame: "daily" | "weekly" | "monthly" | "annualized";
}

const timeFrameLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  annualized: "Annualized",
};

export function VaultYieldsGrid({ vaults, timeFrame }: VaultYieldsGridProps) {
  const getYield = (vault: VaultYieldRow) => {
    switch (timeFrame) {
      case "daily": return vault.dailyYield;
      case "weekly": return vault.weeklyYield;
      case "monthly": return vault.monthlyYield;
      case "annualized": return vault.annualizedYield;
    }
  };

  const columnDefs = useMemo<ColDef<VaultYieldRow>[]>(
    () => [
      {
        headerName: "Vault",
        field: "vaultName",
        flex: 2,
        minWidth: 180,
        cellClass: "font-medium text-text-primary",
        cellRenderer: (params: { data: VaultYieldRow }) => {
          if (!params.data) return null;
          return (
            <div>
              <div className="font-medium text-text-primary">{params.data.vaultName}</div>
              <div className="text-xs text-text-tertiary">{params.data.assetSymbol}</div>
            </div>
          );
        },
      },
      {
        headerName: "Curator",
        field: "curatorName",
        flex: 1,
        minWidth: 120,
        cellClass: "text-text-secondary text-sm",
        valueFormatter: (params) => params.value || "-",
      },
      {
        headerName: "TVL",
        field: "tvl",
        flex: 1,
        minWidth: 110,
        type: "numericColumn",
        cellClass: "font-mono font-medium text-text-primary tabular-nums",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Gross APY",
        headerTooltip: "Time-weighted average annual yield before fees",
        field: "grossApy",
        flex: 0.7,
        minWidth: 90,
        type: "numericColumn",
        cellClass: "text-text-secondary tabular-nums",
        valueFormatter: (params) => `${params.value?.toFixed(2)}%`,
      },
      {
        headerName: "Net APY",
        headerTooltip: "Time-weighted average annual yield after fees — the actual return depositors earn",
        field: "netApy",
        flex: 0.7,
        minWidth: 90,
        type: "numericColumn",
        cellClass: "font-medium text-accent-green tabular-nums",
        valueFormatter: (params) => `${params.value?.toFixed(2)}%`,
      },
      {
        headerName: "Fee",
        field: "performanceFee",
        flex: 0.6,
        minWidth: 70,
        type: "numericColumn",
        cellClass: "text-text-muted tabular-nums text-sm",
        valueFormatter: (params) => `${params.value?.toFixed(1)}%`,
      },
      {
        headerName: `${timeFrameLabels[timeFrame]} Yield`,
        valueGetter: (params) => params.data ? getYield(params.data) : 0,
        flex: 1,
        minWidth: 120,
        type: "numericColumn",
        sort: "desc",
        cellClass: "font-bold text-accent-green tabular-nums text-lg",
        valueFormatter: (params) => formatCurrency(params.value),
      },
    ],
    [timeFrame]
  );

  return (
    <DataGrid<VaultYieldRow>
      rowData={vaults.slice(0, 50)}
      columnDefs={columnDefs}
    />
  );
}

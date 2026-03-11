"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DataGrid } from "./DataGrid";
import { formatCurrency } from "@/lib/utils/format";
import { VaultGradeBadge } from "@/components/VaultGradeBadge";
import { curatorSlug } from "@/lib/curator-aliases";

interface VaultYieldRow {
  vaultId: string;
  vaultAddress: string;
  vaultName: string;
  dataSource?: string;
  grade?: string | null;
  gradeFailures?: string[];
  assetSymbol: string;
  curatorName: string | null;
  curatorAddress?: string | null;
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

function AssetCellRenderer(params: ICellRendererParams) {
  const data = params.data as VaultYieldRow;
  if (!data) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-text-primary">{data.assetSymbol}</span>
      <VaultGradeBadge grade={data.grade} failures={data.gradeFailures} />
    </div>
  );
}

function CuratorCellRenderer(params: ICellRendererParams) {
  const data = params.data as VaultYieldRow;
  if (!data) return null;
  const name = data.curatorName;
  const address = data.curatorAddress;
  if (!name || !address) return <span className="text-text-muted">-</span>;
  return (
    <Link
      href={`/curator/${curatorSlug(name, address)}`}
      className="text-accent-blue hover:underline text-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {name}
    </Link>
  );
}

export function VaultYieldsGrid({ vaults, timeFrame }: VaultYieldsGridProps) {
  const router = useRouter();
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
        headerName: "Asset",
        field: "assetSymbol",
        cellRenderer: AssetCellRenderer,
        flex: 1.2,
        minWidth: 140,
      },
      {
        headerName: "Curator",
        valueGetter: (params) => params.data?.curatorName || null,
        cellRenderer: CuratorCellRenderer,
        flex: 1,
        minWidth: 120,
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
      onRowClicked={(data) => router.push(`/vault/${data.vaultAddress}`)}
    />
  );
}

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DataGrid } from "./DataGrid";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { curatorSlug } from "@/lib/curator-aliases";

// Curator fees grid
interface CuratorFeeRow {
  curatorId: string;
  curatorName: string;
  curatorAddress: string;
  vaultCount: number;
  totalAUM: number;
  avgPerformanceFee: number;
  avgManagementFee: number;
  annualizedCuratorFees: number;
  annualizedMorphoFees: number;
}

interface CuratorFeesGridProps {
  curators: CuratorFeeRow[];
}

function CuratorFeeCellRenderer(params: ICellRendererParams) {
  const data = params.data as CuratorFeeRow;
  if (!data) return null;
  return (
    <div>
      <div className="font-medium text-text-primary">{data.curatorName}</div>
      <div className="text-xs text-text-tertiary font-mono">
        {data.curatorAddress.slice(0, 6)}...{data.curatorAddress.slice(-4)}
      </div>
    </div>
  );
}

export function CuratorFeesGrid({ curators }: CuratorFeesGridProps) {
  const columnDefs = useMemo<ColDef<CuratorFeeRow>[]>(
    () => [
      {
        headerName: "Curator",
        field: "curatorName",
        cellRenderer: CuratorFeeCellRenderer,
        flex: 2,
        minWidth: 180,
      },
      {
        headerName: "AUM",
        field: "totalAUM",
        flex: 1,
        minWidth: 110,
        type: "numericColumn",
        cellClass: "font-mono font-medium text-text-primary tabular-nums",
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Vaults",
        field: "vaultCount",
        flex: 0.5,
        minWidth: 70,
        type: "numericColumn",
        cellClass: "text-text-secondary",
      },
      {
        headerName: "Avg Perf Fee",
        field: "avgPerformanceFee",
        flex: 0.7,
        minWidth: 90,
        type: "numericColumn",
        cellClass: "text-text-secondary",
        valueFormatter: (params) =>
          params.value > 0 ? `${params.value.toFixed(1)}%` : "-",
      },
      {
        headerName: "Avg Mgmt Fee",
        field: "avgManagementFee",
        flex: 0.7,
        minWidth: 90,
        type: "numericColumn",
        cellClass: "text-text-secondary",
        valueFormatter: (params) =>
          params.value > 0 ? `${params.value.toFixed(2)}%` : "-",
      },
      {
        headerName: "Ann. Curator Fees",
        field: "annualizedCuratorFees",
        flex: 1,
        minWidth: 120,
        type: "numericColumn",
        sort: "desc",
        cellClass: "font-semibold tabular-nums",
        cellClassRules: {
          "text-accent-green": (params) => (params.value ?? 0) > 100000,
          "text-text-primary": (params) => (params.value ?? 0) <= 100000,
        },
        valueFormatter: (params) => formatCurrency(params.value),
      },
      {
        headerName: "Ann. Protocol Fees",
        field: "annualizedMorphoFees",
        flex: 1,
        minWidth: 120,
        type: "numericColumn",
        cellClass: "text-text-secondary tabular-nums",
        valueFormatter: (params) => formatCurrency(params.value),
      },
    ],
    []
  );

  return <DataGrid<CuratorFeeRow> rowData={curators} columnDefs={columnDefs} />;
}

// Vault fees grid
interface VaultFeeRow {
  vaultId: string;
  vaultAddress: string;
  vaultName: string;
  dataSource?: string;
  assetSymbol: string;
  curatorName: string | null;
  curatorAddress?: string | null;
  tvl: number;
  apy: number;
  performanceFee: number;
  managementFee: number;
  annualizedCuratorFees: number;
}

interface VaultFeesGridProps {
  vaults: VaultFeeRow[];
}

function AssetCellRenderer(params: ICellRendererParams) {
  const data = params.data as VaultFeeRow;
  if (!data) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-text-primary">{data.assetSymbol}</span>
      <DataSourceBadge dataSource={data.dataSource} />
    </div>
  );
}

function VaultCuratorCellRenderer(params: ICellRendererParams) {
  const data = params.data as VaultFeeRow;
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

export function VaultFeesGrid({ vaults }: VaultFeesGridProps) {
  const router = useRouter();

  const columnDefs = useMemo<ColDef<VaultFeeRow>[]>(
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
        cellRenderer: VaultCuratorCellRenderer,
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
        headerName: "Net APY",
        headerTooltip: "Time-weighted average annual yield after fees — the actual return depositors earn",
        field: "apy",
        flex: 0.7,
        minWidth: 80,
        type: "numericColumn",
        cellClass: "text-accent-green tabular-nums",
        valueFormatter: (params) => `${params.value?.toFixed(2)}%`,
      },
      {
        headerName: "Perf Fee",
        field: "performanceFee",
        flex: 0.6,
        minWidth: 70,
        type: "numericColumn",
        cellClass: "text-text-secondary",
        valueFormatter: (params) =>
          params.value > 0 ? `${params.value.toFixed(0)}%` : "-",
      },
      {
        headerName: "Mgmt Fee",
        field: "managementFee",
        flex: 0.6,
        minWidth: 70,
        type: "numericColumn",
        cellClass: "text-text-secondary",
        valueFormatter: (params) =>
          params.value > 0 ? `${params.value.toFixed(2)}%` : "-",
      },
      {
        headerName: "Ann. Curator Fees",
        field: "annualizedCuratorFees",
        flex: 1,
        minWidth: 120,
        type: "numericColumn",
        sort: "desc",
        cellClass: "font-semibold tabular-nums",
        cellClassRules: {
          "text-accent-green": (params) => (params.value ?? 0) > 100000,
          "text-text-primary": (params) => (params.value ?? 0) <= 100000,
        },
        valueFormatter: (params) => formatCurrency(params.value),
      },
    ],
    []
  );

  return (
    <DataGrid<VaultFeeRow>
      rowData={vaults.slice(0, 50)}
      columnDefs={columnDefs}
      onRowClicked={(data) => router.push(`/vault/${data.vaultAddress}`)}
    />
  );
}

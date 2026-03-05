"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DataGrid } from "./DataGrid";
import { formatCurrency, formatPercentage, formatAddress } from "@/lib/utils/format";
import { NetworkBadge } from "@/components/NetworkBadge";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import type { CuratorVaultSummary } from "@/lib/types/api";

interface CuratorVaultGridProps {
  vaults: CuratorVaultSummary[];
}

function VaultCellRenderer(params: ICellRendererParams) {
  const data = params.data as CuratorVaultSummary;
  if (!data) return null;
  const colors = [
    "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-emerald-500",
    "bg-amber-500", "bg-cyan-500", "bg-indigo-500", "bg-rose-500",
  ];
  const hash = data.address.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const color = colors[Math.abs(hash) % colors.length];

  return (
    <Link href={`/vault/${data.address}`} className="flex items-center gap-2.5 group min-w-0">
      <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0`}>
        {data.symbol.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="flex items-center text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors truncate">
          {data.name}
          <DataSourceBadge dataSource={data.dataSource} />
        </div>
        <div className="text-xs text-text-tertiary font-mono">
          {formatAddress(data.address)}
        </div>
      </div>
    </Link>
  );
}

export function CuratorVaultGrid({ vaults }: CuratorVaultGridProps) {
  const router = useRouter();

  const columnDefs = useMemo<ColDef<CuratorVaultSummary>[]>(
    () => [
      {
        headerName: "Vault",
        field: "name",
        cellRenderer: VaultCellRenderer,
        flex: 2,
        minWidth: 200,
      },
      {
        headerName: "Asset",
        valueGetter: (params) => params.data?.asset?.symbol,
        flex: 0.6,
        minWidth: 70,
        cellClass: "text-text-primary text-sm",
      },
      {
        headerName: "Network",
        valueGetter: (params) => params.data?.chainName ?? "Ethereum",
        cellRenderer: (params: ICellRendererParams) => {
          const network = params.value as string;
          return <NetworkBadge network={network} />;
        },
        flex: 0.7,
        minWidth: 90,
        sortable: true,
      },
      {
        headerName: "Deposits",
        valueGetter: (params) => params.data?.latestSnapshot?.totalAssetsUsd ?? 0,
        valueFormatter: (params) => formatCurrency(params.value),
        flex: 1,
        minWidth: 120,
        type: "numericColumn",
        sort: "desc",
        cellClass: "font-mono font-semibold text-text-primary tabular-nums",
      },
      {
        headerName: "APY",
        headerTooltip: "Time-weighted average annual yield before fees",
        valueGetter: (params) => params.data?.latestSnapshot?.avgApy ?? 0,
        valueFormatter: (params) => formatPercentage(params.value),
        flex: 0.7,
        minWidth: 80,
        type: "numericColumn",
        cellClass: "text-text-secondary tabular-nums",
      },
      {
        headerName: "Net APY",
        headerTooltip: "Time-weighted average annual yield after fees — the actual return depositors earn",
        valueGetter: (params) => params.data?.latestSnapshot?.avgNetApy ?? 0,
        valueFormatter: (params) => formatPercentage(params.value),
        flex: 0.7,
        minWidth: 80,
        type: "numericColumn",
        cellClass: "font-medium text-accent-green tabular-nums",
      },
    ],
    []
  );

  return (
    <DataGrid<CuratorVaultSummary>
      rowData={vaults}
      columnDefs={columnDefs}
      onRowClicked={(data) => router.push(`/vault/${data.address}`)}
    />
  );
}

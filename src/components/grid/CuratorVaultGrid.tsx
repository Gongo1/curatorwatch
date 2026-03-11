"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DataGrid } from "./DataGrid";
import {
  CurrencyRenderer,
  PercentageRenderer,
  ChangeCountRenderer,
} from "./cellRenderers";
import { VaultGradeBadge } from "@/components/VaultGradeBadge";
import { NetworkBadge } from "@/components/NetworkBadge";
import type { CuratorVaultSummary } from "@/lib/types/api";

interface CuratorVaultGridProps {
  vaults: CuratorVaultSummary[];
}

function VaultNameCellRenderer(params: ICellRendererParams) {
  const data = params.data as CuratorVaultSummary;
  if (!data) return null;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-sm font-medium text-text-primary truncate">
          {data.name}
          <VaultGradeBadge grade={data.grade} failures={data.gradeFailures} />
        </div>
        <div className="text-xs text-text-tertiary">{data.asset.symbol}</div>
      </div>
    </div>
  );
}

export function CuratorVaultGrid({ vaults }: CuratorVaultGridProps) {
  const router = useRouter();

  const columnDefs = useMemo<ColDef<CuratorVaultSummary>[]>(
    () => [
      {
        headerName: "Vault",
        valueGetter: (params) => params.data?.name,
        cellRenderer: VaultNameCellRenderer,
        flex: 1.5,
        minWidth: 180,
      },
      {
        headerName: "Network",
        valueGetter: (params) => params.data?.chainName ?? "Ethereum",
        cellRenderer: (params: ICellRendererParams) => {
          const network = params.value as string;
          return <NetworkBadge network={network} />;
        },
        flex: 0.8,
        minWidth: 100,
        sortable: true,
      },
      {
        headerName: "Deposits",
        valueGetter: (params) => params.data?.latestSnapshot?.totalAssetsUsd ?? 0,
        cellRenderer: CurrencyRenderer,
        flex: 1,
        minWidth: 120,
        type: "numericColumn",
        sort: "desc",
      },
      {
        headerName: "APY",
        headerTooltip: "Time-weighted average annual yield before fees",
        valueGetter: (params) => params.data?.latestSnapshot?.avgApy ?? 0,
        cellRenderer: PercentageRenderer,
        flex: 0.7,
        minWidth: 80,
        type: "numericColumn",
      },
      {
        headerName: "Net APY",
        headerTooltip: "Time-weighted average annual yield after fees — the actual return depositors earn",
        valueGetter: (params) => params.data?.latestSnapshot?.avgNetApy ?? 0,
        cellRenderer: PercentageRenderer,
        flex: 0.7,
        minWidth: 80,
        type: "numericColumn",
      },
      {
        headerName: "Changes",
        field: "address",
        cellRenderer: ChangeCountRenderer,
        flex: 0.7,
        minWidth: 80,
        sortable: false,
        cellClass: "flex justify-center",
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

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "./DataGrid";
import {
  VaultNameRenderer,
  AssetBadgeRenderer,
  CurrencyRenderer,
  PercentageRenderer,
  ChangeCountRenderer,
} from "./cellRenderers";
import type { VaultData } from "@/lib/types/api";

interface VaultGridProps {
  vaults: VaultData[];
}

export function VaultGrid({ vaults }: VaultGridProps) {
  const router = useRouter();

  const columnDefs = useMemo<ColDef<VaultData>[]>(
    () => [
      {
        headerName: "Vault",
        field: "name",
        cellRenderer: VaultNameRenderer,
        flex: 2,
        minWidth: 200,
      },
      {
        headerName: "Asset",
        valueGetter: (params) => params.data?.asset?.symbol,
        cellRenderer: AssetBadgeRenderer,
        flex: 0.7,
        minWidth: 80,
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
        valueGetter: (params) => params.data?.latestSnapshot?.apy ?? 0,
        cellRenderer: PercentageRenderer,
        flex: 0.7,
        minWidth: 80,
        type: "numericColumn",
      },
      {
        headerName: "Net APY",
        valueGetter: (params) => params.data?.latestSnapshot?.netApy ?? 0,
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
      {
        headerName: "Curator",
        valueGetter: (params) => params.data?.curatorName || null,
        valueFormatter: (params) => {
          return params.data?.curatorName || "-";
        },
        flex: 1,
        minWidth: 120,
        cellClass: "text-text-secondary text-sm",
      },
    ],
    []
  );

  return (
    <DataGrid<VaultData>
      rowData={vaults}
      columnDefs={columnDefs}
      onRowClicked={(data) => router.push(`/vault/${data.address}`)}
    />
  );
}

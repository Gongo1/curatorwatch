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
  RiskBadgeRenderer,
  ChangeCountRenderer,
} from "./cellRenderers";
import { formatAddress } from "@/lib/utils/format";
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
        valueGetter: (params) => params.data?.latestSnapshot?.avgApy ?? 0,
        cellRenderer: PercentageRenderer,
        flex: 0.7,
        minWidth: 80,
        type: "numericColumn",
      },
      {
        headerName: "Net APY",
        valueGetter: (params) => params.data?.latestSnapshot?.avgNetApy ?? 0,
        cellRenderer: PercentageRenderer,
        flex: 0.7,
        minWidth: 80,
        type: "numericColumn",
      },
      {
        headerName: "Risk",
        valueGetter: (params) => params.data?.riskAssessment?.overallScore ?? 0,
        cellRenderer: RiskBadgeRenderer,
        flex: 0.8,
        minWidth: 100,
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
        field: "curatorAddress",
        valueFormatter: (params) =>
          params.value ? formatAddress(params.value) : "-",
        flex: 0.8,
        minWidth: 100,
        cellClass: "font-mono text-text-tertiary text-xs",
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

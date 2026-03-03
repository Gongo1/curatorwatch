"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "./DataGrid";
import {
  CuratorNameRenderer,
  CurrencyRenderer,
  AssetDistributionRenderer,
  NetworkBadgesRenderer,
  ProtocolBadgesRenderer,
} from "./cellRenderers";
import type { CuratorDashboardItem } from "@/lib/types/api";

interface CuratorGridProps {
  curators: CuratorDashboardItem[];
}

export function CuratorGrid({ curators }: CuratorGridProps) {
  const router = useRouter();

  const columnDefs = useMemo<ColDef<CuratorDashboardItem>[]>(
    () => [
      {
        headerName: "Curator",
        field: "name",
        cellRenderer: CuratorNameRenderer,
        flex: 2,
        minWidth: 200,
        comparator: (a: string, b: string) =>
          (a || "").toLowerCase().localeCompare((b || "").toLowerCase()),
      },
      {
        headerName: "Total AUM",
        field: "totalAUM",
        cellRenderer: CurrencyRenderer,
        flex: 1,
        minWidth: 130,
        type: "numericColumn",
        sort: "desc",
      },
      {
        headerName: "# Vaults",
        field: "vaultCount",
        flex: 0.6,
        minWidth: 90,
        type: "numericColumn",
        cellClass: "text-text-secondary tabular-nums",
      },
      {
        headerName: "Networks",
        field: "networks",
        cellRenderer: NetworkBadgesRenderer,
        flex: 1,
        minWidth: 120,
        sortable: false,
      },
      {
        headerName: "Protocols",
        field: "protocols",
        cellRenderer: ProtocolBadgesRenderer,
        flex: 1,
        minWidth: 120,
        sortable: false,
      },
      {
        headerName: "Assets",
        field: "assetDistribution",
        cellRenderer: AssetDistributionRenderer,
        flex: 1.2,
        minWidth: 150,
        sortable: false,
      },
    ],
    []
  );

  return (
    <DataGrid<CuratorDashboardItem>
      rowData={curators}
      columnDefs={columnDefs}
      onRowClicked={(data) => router.push(`/curator/${data.curatorAddress}`)}
    />
  );
}

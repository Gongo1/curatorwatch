"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DataGrid } from "./DataGrid";
import {
  CurrencyRenderer,
  PercentageRenderer,
  ChangeCountRenderer,
} from "./cellRenderers";
import { VaultGradeBadge } from "@/components/VaultGradeBadge";
import { curatorSlug } from "@/lib/curator-aliases";
import type { VaultData } from "@/lib/types/api";

interface VaultGridProps {
  vaults: VaultData[];
}

function AssetCellRenderer(params: ICellRendererParams) {
  const data = params.data as VaultData;
  if (!data) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium text-text-primary">{data.asset.symbol}</span>
      <VaultGradeBadge grade={data.grade} failures={data.gradeFailures} />
    </div>
  );
}

function CuratorCellRenderer(params: ICellRendererParams) {
  const data = params.data as VaultData;
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

export function VaultGrid({ vaults }: VaultGridProps) {
  const router = useRouter();

  const columnDefs = useMemo<ColDef<VaultData>[]>(
    () => [
      {
        headerName: "Asset",
        valueGetter: (params) => params.data?.asset?.symbol,
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
    <DataGrid<VaultData>
      rowData={vaults}
      columnDefs={columnDefs}
      onRowClicked={(data) => router.push(`/vault/${data.address}`)}
    />
  );
}

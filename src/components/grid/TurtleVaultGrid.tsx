"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DataGrid } from "./DataGrid";
import {
  CurrencyRenderer,
  ChangeCountRenderer,
} from "./cellRenderers";
import { VaultGradeBadge } from "@/components/VaultGradeBadge";
import { curatorSlug } from "@/lib/curator-aliases";
import type { VaultData } from "@/lib/types/api";

interface TurtleVaultGridProps {
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
  if (!name) return <span className="text-text-muted">-</span>;
  if (!address) return <span className="text-sm text-text-primary">{name}</span>;
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

function APRRenderer(params: ICellRendererParams) {
  const value = params.value;
  if (value == null || value === 0) return <span className="text-text-muted">-</span>;
  return (
    <span className="font-mono font-medium text-accent-green tabular-nums">
      {value.toFixed(2)}%
    </span>
  );
}

export function TurtleVaultGrid({ vaults }: TurtleVaultGridProps) {
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
        headerName: "Est. Total APR",
        headerTooltip: "Estimated Total APR reported by the Turtle API",
        valueGetter: (params) => params.data?.estTotalAPR ?? 0,
        cellRenderer: APRRenderer,
        flex: 0.8,
        minWidth: 110,
        type: "numericColumn",
      },
      {
        headerName: "Net APR",
        headerTooltip: "Est. Total APR after fees",
        valueGetter: (params) => params.data?.netAPR ?? 0,
        cellRenderer: APRRenderer,
        flex: 0.7,
        minWidth: 90,
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

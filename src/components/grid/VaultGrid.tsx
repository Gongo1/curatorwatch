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
  stripCuratorPrefix,
} from "./cellRenderers";
import { VaultGradeBadge } from "@/components/VaultGradeBadge";
import { VaultWarningBadge } from "@/components/VaultWarningBadge";
import { MorphoVerifiedBadge } from "@/components/MorphoVerifiedBadge";
import { curatorSlug } from "@/lib/curator-aliases";
import type { VaultData } from "@/lib/types/api";

interface VaultGridProps {
  vaults: VaultData[];
}

function VaultNameCellRenderer(params: ICellRendererParams) {
  const data = params.data as VaultData;
  if (!data) return null;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-sm font-medium text-text-primary truncate">
          {stripCuratorPrefix(data.name, data.curatorName)}
          <VaultGradeBadge grade={data.grade} failures={data.gradeFailures} />
          <VaultWarningBadge warnings={data.warnings} />
          <MorphoVerifiedBadge listed={data.listed} />
        </div>
        <div className="text-xs text-text-tertiary">{data.asset.symbol}</div>
      </div>
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

export function VaultGrid({ vaults }: VaultGridProps) {
  const router = useRouter();

  const columnDefs = useMemo<ColDef<VaultData>[]>(
    () => [
      {
        headerName: "Vault",
        valueGetter: (params) => params.data?.name,
        cellRenderer: VaultNameCellRenderer,
        flex: 1.5,
        minWidth: 180,
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

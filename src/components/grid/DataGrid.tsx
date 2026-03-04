"use client";

import { useMemo, useRef, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef, type GridReadyEvent } from "ag-grid-community";

// Register AG Grid Community modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface DataGridProps<T> {
  rowData: T[];
  columnDefs: ColDef<T>[];
  domLayout?: "normal" | "autoHeight";
  loading?: boolean;
  rowHeight?: number;
  headerHeight?: number;
  onRowClicked?: (data: T) => void;
  className?: string;
  overlayNoRowsTemplate?: string;
}

export function DataGrid<T>({
  rowData,
  columnDefs,
  domLayout = "autoHeight",
  loading = false,
  rowHeight = 44,
  headerHeight = 40,
  onRowClicked,
  className = "",
  overlayNoRowsTemplate = "No data available",
}: DataGridProps<T>) {
  const gridRef = useRef<AgGridReact<T>>(null);

  const defaultColDef = useMemo<ColDef<T>>(
    () => ({
      sortable: true,
      resizable: true,
      suppressMovable: true,
    }),
    []
  );

  const onGridReady = useCallback((params: GridReadyEvent<T>) => {
    params.api.sizeColumnsToFit();
  }, []);

  const handleRowClicked = useCallback(
    (event: { data: T | undefined }) => {
      if (onRowClicked && event.data) {
        onRowClicked(event.data);
      }
    },
    [onRowClicked]
  );

  return (
    <div className={`ag-theme-curatorwatch ${className}`}>
      <AgGridReact<T>
        ref={gridRef}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        domLayout={domLayout}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
        animateRows={true}
        loading={loading}
        onGridReady={onGridReady}
        onRowClicked={handleRowClicked}
        overlayNoRowsTemplate={overlayNoRowsTemplate}
        suppressCellFocus={true}
        enableCellTextSelection={true}
        tooltipShowDelay={300}
      />
    </div>
  );
}

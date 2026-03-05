"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CuratorAvatar } from "@/components/CuratorAvatar";
import { formatCurrency } from "@/lib/utils/format";
import { curatorSlug } from "@/lib/curator-aliases";

interface TopCurator {
  curatorId: string;
  curatorAddress: string;
  name: string | null;
  logoUrl: string | null;
  totalAUM: number;
}

type DataSourceFilter = "all" | "morpho" | "turtle";

const DATA_SOURCE_OPTIONS: { value: DataSourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "morpho", label: "Morpho [TBA]" },
  { value: "turtle", label: "Turtle" },
];

export function TopCurators() {
  const [curators, setCurators] = useState<TopCurator[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSourceFilter, setDataSourceFilter] = useState<DataSourceFilter>("all");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          pageSize: "5",
          sortBy: "aum",
          sortOrder: "desc",
        });
        if (dataSourceFilter !== "all") {
          params.set("dataSource", dataSourceFilter);
        }
        const response = await fetch(`/api/curators?${params.toString()}`);
        const result = await response.json();

        if (result.success && result.data?.curators) {
          setCurators(result.data.curators.slice(0, 5));
        }
      } catch (err) {
        console.error("Failed to fetch top curators:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [dataSourceFilter]);

  if (loading) {
    return (
      <div className="bg-background-subtle border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-28 bg-background-elevated rounded animate-pulse" />
          <div className="h-4 w-16 bg-background-elevated rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 bg-background-elevated rounded animate-pulse" />
              <div className="w-8 h-8 bg-background-elevated rounded-lg animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-24 bg-background-elevated rounded animate-pulse" />
              </div>
              <div className="h-4 w-16 bg-background-elevated rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-subtle border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Top Curators</h3>
        <Link
          href="/"
          className="text-xs text-accent-blue hover:text-accent-blue-hover transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="flex items-center gap-1 mb-3">
        {DATA_SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setDataSourceFilter(opt.value)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              dataSourceFilter === opt.value
                ? "bg-accent-blue text-white"
                : "bg-background-elevated text-text-muted hover:text-text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {curators.map((curator, index) => (
          <Link
            key={curator.curatorId}
            href={`/curator/${curatorSlug(curator.name, curator.curatorAddress)}`}
            className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-background-hover transition-colors group"
          >
            <span className="w-5 text-xs font-medium text-text-muted text-center">
              {index + 1}
            </span>
            <CuratorAvatar
              address={curator.curatorAddress}
              name={curator.name}
              logoUrl={curator.logoUrl}
              size="xs"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate group-hover:text-accent-blue transition-colors">
                {curator.name || `Curator ${curator.curatorAddress.slice(0, 6)}...`}
              </p>
            </div>
            <span className="text-sm font-semibold text-text-primary tabular-nums">
              {formatCurrency(curator.totalAUM)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

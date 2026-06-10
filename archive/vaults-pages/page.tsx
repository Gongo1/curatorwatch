"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatCurrency } from "@/lib/utils/format";
import type { VaultsApiResponse } from "@/lib/types/api";

interface VaultStats {
  count: number;
  totalTvl: number;
}

export default function VaultsPage() {
  const [morphoStats, setMorphoStats] = useState<VaultStats>({ count: 0, totalTvl: 0 });
  const [turtleStats, setTurtleStats] = useState<VaultStats>({ count: 0, totalTvl: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [morphoRes, turtleRes] = await Promise.all([
          fetch("/api/vaults?dataSource=morpho"),
          fetch("/api/vaults?dataSource=turtle"),
        ]);

        const [morphoData, turtleData]: [VaultsApiResponse, VaultsApiResponse] = await Promise.all([
          morphoRes.json(),
          turtleRes.json(),
        ]);

        if (morphoData.success) {
          setMorphoStats({
            count: morphoData.data.length,
            totalTvl: morphoData.data.reduce(
              (sum, v) => sum + (v.latestSnapshot?.totalAssetsUsd ?? 0),
              0
            ),
          });
        }

        if (turtleData.success) {
          setTurtleStats({
            count: turtleData.data.length,
            totalTvl: turtleData.data.reduce(
              (sum, v) => sum + (v.latestSnapshot?.totalAssetsUsd ?? 0),
              0
            ),
          });
        }
      } catch {
        // Stats will stay at defaults
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <>
      <PageHeader
        title="Vaults"
        description="Browse vaults by data source"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Vaults" }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Morpho Card */}
        <Link href="/vaults/morpho" className="group">
          <div className="rounded-xl border border-border bg-background-subtle p-6 hover:border-accent-blue/40 hover:bg-accent-blue/5 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-accent-blue/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary group-hover:text-accent-blue transition-colors">
                  Morpho Midnight Vaults
                </h2>
                <p className="text-sm text-text-tertiary">ERC4626 vaults with full allocation data</p>
              </div>
            </div>
            {loading ? (
              <div className="flex gap-6 animate-pulse">
                <div className="h-5 w-20 bg-background-elevated rounded" />
                <div className="h-5 w-28 bg-background-elevated rounded" />
              </div>
            ) : (
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-text-secondary">Vaults: </span>
                  <span className="font-semibold text-text-primary">{morphoStats.count}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div>
                  <span className="text-text-secondary">Total Deposits: </span>
                  <span className="font-semibold text-text-primary tabular-nums">{formatCurrency(morphoStats.totalTvl)}</span>
                </div>
              </div>
            )}
            <p className="mt-3 text-xs text-text-muted">
              Yield shown as APY (compound interest)
            </p>
          </div>
        </Link>

        {/* Turtle Card */}
        <Link href="/vaults/turtle" className="group">
          <div className="rounded-xl border border-border bg-background-subtle p-6 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary group-hover:text-cyan-500 transition-colors">
                  Turtle Vaults
                </h2>
                <p className="text-sm text-text-tertiary">Cross-protocol managed vaults</p>
              </div>
            </div>
            {loading ? (
              <div className="flex gap-6 animate-pulse">
                <div className="h-5 w-20 bg-background-elevated rounded" />
                <div className="h-5 w-28 bg-background-elevated rounded" />
              </div>
            ) : (
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-text-secondary">Vaults: </span>
                  <span className="font-semibold text-text-primary">{turtleStats.count}</span>
                </div>
                <div className="w-px h-4 bg-border" />
                <div>
                  <span className="text-text-secondary">Total Deposits: </span>
                  <span className="font-semibold text-text-primary tabular-nums">{formatCurrency(turtleStats.totalTvl)}</span>
                </div>
              </div>
            )}
            <p className="mt-3 text-xs text-text-muted">
              Yield shown as Est. Total APR (simple interest)
            </p>
          </div>
        </Link>
      </div>
    </>
  );
}

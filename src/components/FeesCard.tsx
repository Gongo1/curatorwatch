"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";

interface FeesData {
  vault: {
    name: string;
    address: string;
    tvl: number;
    apy: number;
    grossApy: number;
  };
  dataSource: string;
  feeRates: {
    performanceFee: number;
    managementFee: number;
    protocolFee: number;
  };
  curator: {
    name: string;
    address: string | null;
  };
  estimatedFees: {
    period: string;
    curatorFees: {
      management: number;
      performance: number;
      total: number;
    };
    morphoFees: number;
    totalFees: number;
  };
  annualized: {
    curatorFees: number;
    morphoFees: number;
    totalFees: number;
  };
}

interface FeesCardProps {
  vaultAddress: string;
}

export function FeesCard({ vaultAddress }: FeesCardProps) {
  const [fees, setFees] = useState<FeesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFees() {
      try {
        const response = await fetch(`/api/vaults/${vaultAddress}/fees`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch fees");
        }

        setFees(data.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load fees");
      } finally {
        setLoading(false);
      }
    }

    fetchFees();
  }, [vaultAddress]);

  if (loading) {
    return (
      <section className="bg-background-subtle rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border">
          <div className="h-5 w-32 bg-background-elevated rounded animate-pulse" />
        </div>
        <div className="px-6 py-6 space-y-4">
          <div className="h-20 bg-background-elevated rounded animate-pulse" />
          <div className="h-20 bg-background-elevated rounded animate-pulse" />
        </div>
      </section>
    );
  }

  if (error || !fees) {
    return (
      <section className="bg-background-subtle rounded-lg border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Fee Analysis</h2>
        </div>
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-text-tertiary">Unable to calculate fees</p>
        </div>
      </section>
    );
  }

  const { feeRates, estimatedFees, annualized, curator } = fees;

  return (
    <section className="bg-background-subtle rounded-lg border border-border">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-base font-semibold text-text-primary">Fee Analysis</h2>
        <p className="text-sm text-text-tertiary">
          Estimated fees based on {estimatedFees.period} of operation
        </p>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* Fee Rates */}
        <div>
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
            Fee Rates
          </h3>
          <div className={`grid gap-4 ${fees.dataSource === "morpho" ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="bg-background-elevated rounded-lg p-3">
              <p className="text-xs text-text-tertiary">Performance Fee</p>
              <p className="text-lg font-semibold text-text-primary tabular-nums">
                {feeRates.performanceFee.toFixed(1)}%
              </p>
            </div>
            <div className="bg-background-elevated rounded-lg p-3">
              <p className="text-xs text-text-tertiary">Management Fee</p>
              <p className="text-lg font-semibold text-text-primary tabular-nums">
                {feeRates.managementFee.toFixed(2)}%
              </p>
            </div>
            {fees.dataSource === "morpho" && (
              <div className="bg-background-elevated rounded-lg p-3">
                <p className="text-xs text-text-tertiary">Morpho Protocol</p>
                <p className="text-lg font-semibold text-text-primary tabular-nums">
                  {feeRates.protocolFee.toFixed(0)}%
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Estimated Fees Breakdown */}
        <div>
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
            Estimated Fees Paid ({estimatedFees.period})
          </h3>
          <div className="space-y-2">
            {/* Curator Fees */}
            <div className="flex items-center justify-between py-2 border-b border-border-subtle">
              <div>
                <p className="text-sm text-text-primary">Curator Fees</p>
                <p className="text-xs text-text-tertiary">
                  {curator.name} (Performance + Management)
                </p>
              </div>
              <p className="text-sm font-semibold text-accent-blue tabular-nums">
                {formatCurrency(estimatedFees.curatorFees.total)}
              </p>
            </div>

            {/* Breakdown */}
            <div className="pl-4 space-y-1">
              <div className="flex items-center justify-between py-1">
                <p className="text-xs text-text-tertiary">Performance fees</p>
                <p className="text-xs text-text-secondary tabular-nums">
                  {formatCurrency(estimatedFees.curatorFees.performance)}
                </p>
              </div>
              <div className="flex items-center justify-between py-1">
                <p className="text-xs text-text-tertiary">Management fees</p>
                <p className="text-xs text-text-secondary tabular-nums">
                  {formatCurrency(estimatedFees.curatorFees.management)}
                </p>
              </div>
            </div>

            {/* Protocol Fees — only shown for Morpho vaults */}
            {fees.dataSource === "morpho" && (
              <div className="flex items-center justify-between py-2 border-b border-border-subtle">
                <div>
                  <p className="text-sm text-text-primary">Morpho Protocol Fees</p>
                  <p className="text-xs text-text-tertiary">
                    15% of interest earned
                  </p>
                </div>
                <p className="text-sm font-semibold text-accent-purple tabular-nums">
                  {formatCurrency(estimatedFees.morphoFees)}
                </p>
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between py-3 bg-background-elevated rounded-lg px-3 mt-3">
              <p className="text-sm font-medium text-text-primary">Total Fees</p>
              <p className="text-lg font-bold text-text-primary tabular-nums">
                {formatCurrency(estimatedFees.totalFees)}
              </p>
            </div>
          </div>
        </div>

        {/* Annualized Projections */}
        <div>
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-3">
            Annualized Projections
          </h3>
          <div className={`grid gap-4 ${fees.dataSource === "morpho" ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="text-center p-3 rounded-lg border border-accent-blue/20 bg-accent-blue/5">
              <p className="text-xs text-text-tertiary mb-1">Curator</p>
              <p className="text-base font-semibold text-accent-blue tabular-nums">
                {formatCurrency(annualized.curatorFees)}
              </p>
            </div>
            {fees.dataSource === "morpho" && (
              <div className="text-center p-3 rounded-lg border border-accent-purple/20 bg-accent-purple/5">
                <p className="text-xs text-text-tertiary mb-1">Morpho Protocol</p>
                <p className="text-base font-semibold text-accent-purple tabular-nums">
                  {formatCurrency(annualized.morphoFees)}
                </p>
              </div>
            )}
            <div className="text-center p-3 rounded-lg border border-border bg-background-elevated">
              <p className="text-xs text-text-tertiary mb-1">Total</p>
              <p className="text-base font-semibold text-text-primary tabular-nums">
                {formatCurrency(annualized.totalFees)}
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-text-muted text-center pt-2 border-t border-border-subtle">
          Estimates based on current deposits and APY. Actual fees vary with market conditions.
        </p>
      </div>
    </section>
  );
}

"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";
import { Panel } from "@/components/layout/Panel";

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
      <Panel title="Fee analysis" bodyClassName="p-3 space-y-2 animate-pulse">
        <div className="h-14 bg-background-elevated" />
        <div className="h-24 bg-background-elevated" />
      </Panel>
    );
  }

  if (error || !fees) {
    return (
      <Panel title="Fee analysis" bodyClassName="p-3">
        <p className="text-sm text-text-tertiary">
          Fee estimates could not be calculated for this vault. Reload the page to try again.
        </p>
      </Panel>
    );
  }

  const { feeRates, estimatedFees, annualized, curator } = fees;
  const isMorpho = fees.dataSource === "morpho";

  return (
    <Panel title="Fee analysis" meta={`est. over ${estimatedFees.period}`}>
      {/* Fee Rates */}
      <dl className={`grid ${isMorpho ? "grid-cols-3" : "grid-cols-2"} border-b border-border`}>
        <Stat k="Performance fee" v={`${feeRates.performanceFee.toFixed(1)}%`} />
        <Stat k="Management fee" v={`${feeRates.managementFee.toFixed(2)}%`} />
        {isMorpho && <Stat k="Protocol fee" v={`${feeRates.protocolFee.toFixed(0)}%`} />}
      </dl>

      {/* Estimated Fees Breakdown */}
      <div className="px-3 pt-2.5">
        <h3 className="label mb-1">Estimated fees paid ({estimatedFees.period})</h3>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Estimated fees paid over {estimatedFees.period}</caption>
        <tbody>
          <tr className="h-9 border-b border-border-subtle">
            <th scope="row" className="pl-3 text-left font-normal">
              <span className="text-text-primary">Curator fees</span>
              <span className="ml-2 text-xs text-text-tertiary">{curator.name} (performance + management)</span>
            </th>
            <td className="pr-3 text-right num font-semibold text-text-primary">
              {formatCurrency(estimatedFees.curatorFees.total)}
            </td>
          </tr>
          <tr className="h-7 border-b border-border-subtle">
            <th scope="row" className="pl-6 text-left font-normal text-xs text-text-tertiary">Performance fees</th>
            <td className="pr-3 text-right num text-xs text-text-secondary">
              {formatCurrency(estimatedFees.curatorFees.performance)}
            </td>
          </tr>
          <tr className="h-7 border-b border-border-subtle">
            <th scope="row" className="pl-6 text-left font-normal text-xs text-text-tertiary">Management fees</th>
            <td className="pr-3 text-right num text-xs text-text-secondary">
              {formatCurrency(estimatedFees.curatorFees.management)}
            </td>
          </tr>
          {/* Protocol Fees — only shown for Morpho vaults */}
          {isMorpho && (
            <tr className="h-9 border-b border-border-subtle">
              <th scope="row" className="pl-3 text-left font-normal">
                <span className="text-text-primary">Morpho protocol fees</span>
                <span className="ml-2 text-xs text-text-tertiary">15% of interest earned</span>
              </th>
              <td className="pr-3 text-right num font-semibold text-text-primary">
                {formatCurrency(estimatedFees.morphoFees)}
              </td>
            </tr>
          )}
          <tr className="h-9 border-b border-border bg-background-elevated">
            <th scope="row" className="pl-3 text-left label text-text-secondary">Total fees</th>
            <td className="pr-3 text-right num font-bold text-text-primary">
              {formatCurrency(estimatedFees.totalFees)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Annualized Projections */}
      <div className="px-3 pt-2.5">
        <h3 className="label">Annualized projections</h3>
      </div>
      <dl className={`grid ${isMorpho ? "grid-cols-3" : "grid-cols-2"} border-b border-border-subtle`}>
        <Stat k="Curator" v={formatCurrency(annualized.curatorFees)} />
        {isMorpho && <Stat k="Morpho protocol" v={formatCurrency(annualized.morphoFees)} />}
        <Stat k="Total" v={formatCurrency(annualized.totalFees)} />
      </dl>

      {/* Disclaimer */}
      <p className="px-3 py-2 text-xs text-text-muted">
        Estimates use current deposits and APY. Actual fees vary with market conditions.
      </p>
    </Panel>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="px-3 py-2 border-r border-border-subtle last:border-r-0 min-w-0">
      <dt className="label">{k}</dt>
      <dd className="num text-base font-semibold text-text-primary mt-1 truncate">{v}</dd>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getDistributorDeposits,
  TURTLE_DISTRIBUTOR_ID,
  type DepositRecord,
} from "@/lib/turtle/earn-client";
import { chainName } from "@/lib/turtle/useEthereum";

function shortHex(h: string): string {
  return h.length > 14 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h;
}

function fmtUsd(v?: string | null): string {
  const n = v == null ? NaN : Number(v);
  return isNaN(n)
    ? "—"
    : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtTime(ts?: string | null): string {
  if (!ts) return "—";
  const n = Number(ts);
  const ms = !isNaN(n)
    ? String(ts).length <= 10
      ? n * 1000
      : n
    : Date.parse(ts);
  return isNaN(ms) ? String(ts) : new Date(ms).toLocaleString();
}

// Phase 4: deposits attributed to CuratorWatch (GET /v1/deposit/{distributorId}).
// Refreshes whenever `refreshKey` changes (bumped after a successful deposit).
export function DepositsTracker({ refreshKey }: { refreshKey?: number }) {
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await getDistributorDeposits({ limit: 20 });
      setDeposits(page.deposits);
      setTotal(page.pagination?.total ?? page.deposits.length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load deposits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">
          Deposits attributed to CuratorWatch
          {TURTLE_DISTRIBUTOR_ID ? ` (${TURTLE_DISTRIBUTOR_ID})` : ""}
          {total != null && (
            <span className="ml-2 text-text-tertiary font-normal">{total}</span>
          )}
        </h2>
        <button
          onClick={load}
          className="text-xs text-cyan-500 hover:text-cyan-400 font-medium"
        >
          Refresh
        </button>
      </div>

      {error && <div className="text-sm text-accent-red mb-2">{error}</div>}

      {loading ? (
        <div className="h-12 bg-background-elevated rounded-lg animate-pulse" />
      ) : deposits.length === 0 ? (
        <div className="text-sm text-text-tertiary p-4 bg-background-subtle border border-border rounded-lg">
          No attributed deposits yet.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-tertiary text-xs border-b border-border">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Wallet</th>
                <th className="px-3 py-2 font-medium">Chain</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id || d.txHash} className="border-b border-border/50">
                  <td className="px-3 py-2 text-text-secondary whitespace-nowrap">
                    {fmtTime(d.blockTimestamp)}
                  </td>
                  <td className="px-3 py-2 font-mono text-text-secondary">
                    {shortHex(d.walletAddress)}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {chainName(d.chainId ?? null)}
                  </td>
                  <td className="px-3 py-2 text-right text-text-primary tabular-nums whitespace-nowrap">
                    {fmtUsd(d.amountInUsd)}
                    {d.tokenSymbol ? ` · ${d.tokenSymbol}` : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-text-tertiary">
                    {shortHex(d.txHash)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getDistributorOpportunities,
  chainLabel,
  isDepositable,
  TURTLE_DISTRIBUTOR_ID,
  type EarnOpportunity,
} from "@/lib/turtle/earn-client";
import { useEthereum, chainName } from "@/lib/turtle/useEthereum";
import { formatCurrency } from "@/lib/utils/format";

function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

// /deposit: discover (curated set) + wallet connect. Membership, deposit, and verify
// land in later phases. Validates auth + the pk_live_ origin allowlist, and the raw
// window.ethereum wallet primitive, before any on-chain action.
export function DepositApp() {
  const wallet = useEthereum();
  const [opps, setOpps] = useState<EarnOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const curated = await getDistributorOpportunities();
      curated.sort(
        (a, b) =>
          Number(b.featured ?? false) - Number(a.featured ?? false) ||
          (b.tvl ?? 0) - (a.tvl ?? 0)
      );
      setOpps(curated);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load opportunities"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Deposit"
        description="Deposit into Turtle opportunities directly through CuratorWatch (preview)"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Deposit" }]}
      />

      <div className="mb-6 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
        <p className="text-sm text-text-secondary">
          <span className="font-medium text-cyan-500">Preview.</span> Deposits
          made here are attributed on-chain to CuratorWatch
          {TURTLE_DISTRIBUTOR_ID ? ` (${TURTLE_DISTRIBUTOR_ID})` : ""}. Showing
          opportunities curated under our distributor ID via the Turtle Earn API.
        </p>
      </div>

      {/* Wallet bar */}
      <div className="mb-6 flex items-center justify-between p-4 bg-background-elevated border border-border rounded-xl">
        <div className="text-sm">
          {wallet.account ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-cyan-500 rounded-full" />
              <span className="font-mono text-text-primary">
                {shortAddr(wallet.account)}
              </span>
              <span className="text-text-tertiary">·</span>
              <span className="text-text-secondary">
                {chainName(wallet.chainId)}
              </span>
            </span>
          ) : wallet.available ? (
            <span className="text-text-secondary">
              Connect a wallet to deposit.
            </span>
          ) : (
            <span className="text-text-secondary">
              No Ethereum wallet detected — install MetaMask to deposit.
            </span>
          )}
        </div>
        {wallet.available && !wallet.account && (
          <button
            onClick={() => wallet.connect()}
            disabled={wallet.connecting}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
          >
            {wallet.connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>

      {wallet.error && (
        <div className="mb-6 p-3 bg-accent-red-muted/30 border border-accent-red/30 rounded-lg text-sm text-accent-red">
          {wallet.error}
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-accent-red-muted/30 border border-accent-red/30 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-accent-red">
                Error loading opportunities
              </h3>
              <p className="text-sm text-text-secondary mt-1">{error}</p>
            </div>
            <button
              onClick={load}
              className="text-sm text-accent-red hover:text-accent-red font-medium"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-background-elevated rounded-xl" />
          ))}
        </div>
      )}

      {!loading && !error && opps.length > 0 && (
        <div className="space-y-2">
          {opps.map((o) => {
            const token = o.depositTokens?.[0];
            return (
              <div
                key={o.id}
                className="flex items-center justify-between p-4 bg-background-elevated border border-border rounded-xl"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary truncate">
                      {o.name}
                    </span>
                    {o.featured && (
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-cyan-500 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                        Featured
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text-secondary">
                    {token?.symbol ?? "—"}
                    {chainLabel(token) ? ` · ${chainLabel(token)}` : ""}
                    {o.curator?.name ? ` · ${o.curator.name}` : ""}
                  </div>
                </div>
                <div className="text-right text-sm shrink-0 pl-4">
                  <div className="text-text-secondary">
                    TVL{" "}
                    <span className="text-text-primary tabular-nums">
                      {formatCurrency(o.tvl)}
                    </span>
                  </div>
                  <div className="text-text-tertiary text-xs mt-0.5">
                    {isDepositable(o)
                      ? o.swapDirectEnabled
                        ? "direct"
                        : "swap"
                      : "not depositable"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && opps.length === 0 && (
        <div className="text-center py-16 bg-background-subtle rounded-lg border border-border">
          <h3 className="text-sm font-medium text-text-primary">
            No curated opportunities
          </h3>
          <p className="mt-2 text-sm text-text-secondary">
            The distributor-curated set came back empty.
          </p>
        </div>
      )}
    </>
  );
}

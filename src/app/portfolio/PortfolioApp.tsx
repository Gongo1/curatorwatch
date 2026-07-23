"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Wallet, Search, ExternalLink, ShieldQuestion } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEthereum, chainName } from "@/lib/turtle/useEthereum";
import { formatCurrency, formatTimeAgo } from "@/lib/utils/format";
import type {
  PortfolioResponse,
  EnrichedPosition,
} from "@/app/api/portfolio/[address]/route";

type PortfolioData = PortfolioResponse["data"];

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function PortfolioApp() {
  const wallet = useEthereum();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [input, setInput] = useState("");
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load an address: validate, reflect it in the URL (shareable), and trigger a fetch.
  const loadAddress = useCallback(
    (raw: string) => {
      const addr = raw.trim().toLowerCase();
      if (!ADDRESS_RE.test(addr)) {
        setError("Enter a valid EVM address (0x…).");
        return;
      }
      setError(null);
      setInput(addr);
      setActiveAddress(addr);
      router.replace(`/portfolio?address=${addr}`, { scroll: false });
    },
    [router]
  );

  // Hydrate from ?address= on first load (deep links / shares).
  useEffect(() => {
    const fromUrl = searchParams.get("address");
    if (fromUrl && ADDRESS_RE.test(fromUrl.toLowerCase())) {
      const a = fromUrl.toLowerCase();
      setInput(a);
      setActiveAddress(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch whenever the active address changes.
  useEffect(() => {
    if (!activeAddress) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/portfolio/${activeAddress}`)
      .then((r) => r.json())
      .then((json: PortfolioResponse) => {
        if (cancelled) return;
        if (json.success) setData(json.data);
        else {
          setData(null);
          setError(json.error ?? "Failed to load portfolio.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load portfolio.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAddress]);

  const onConnect = useCallback(async () => {
    const a = wallet.account ?? (await wallet.connect());
    if (a) loadAddress(a);
  }, [wallet, loadAddress]);

  return (
    <div>
      <PageHeader
        title="Portfolio"
        description="See your DeFi positions and the curators behind them on CuratorWatch."
        breadcrumbs={[{ label: "CuratorWatch", href: "/" }, { label: "Portfolio" }]}
      />

      {/* Address input */}
      <div className="rounded-lg border border-border bg-background-elevated p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <form
            className="flex-1 flex gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              loadAddress(input);
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="0x… paste any wallet address"
                spellCheck={false}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm text-text-primary placeholder:text-text-muted font-mono focus:outline-none focus:border-accent-blue"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-accent-blue text-background text-sm font-medium hover:bg-accent-blue-hover transition-colors whitespace-nowrap"
            >
              View
            </button>
          </form>
          {wallet.available && (
            <button
              onClick={onConnect}
              disabled={wallet.connecting}
              className="px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium text-text-primary hover:bg-background-hover transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60"
            >
              <Wallet className="w-4 h-4" />
              {wallet.connecting
                ? "Connecting…"
                : wallet.account
                  ? `Use ${shortAddr(wallet.account)}`
                  : "Connect wallet"}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
      </div>

      {/* States */}
      {!activeAddress && !loading && <EmptyState />}
      {loading && (
        <div className="rounded-lg border border-border bg-background-elevated p-10 text-center text-text-tertiary text-sm">
          Loading portfolio for {activeAddress ? shortAddr(activeAddress) : ""}…
        </div>
      )}
      {!loading && data && data.positionCount === 0 && (
        <div className="rounded-lg border border-border bg-background-elevated p-10 text-center text-text-tertiary text-sm">
          No open DeFi positions found for {shortAddr(data.address)}.
        </div>
      )}
      {!loading && data && data.positionCount > 0 && <Dashboard data={data} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-background-elevated p-10 text-center">
      <Wallet className="w-8 h-8 text-text-muted mx-auto mb-3" />
      <p className="text-text-secondary text-sm max-w-md mx-auto">
        Connect a wallet or paste any address to see its DeFi positions across protocols —
        joined to the curator managing each one.
      </p>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background-elevated p-4">
      <p className="text-[11px] uppercase tracking-wider text-text-tertiary font-mono">{label}</p>
      <p className="text-2xl font-bold text-text-primary mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}

function Dashboard({ data }: { data: PortfolioData }) {
  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total value" value={formatCurrency(data.totalNetUsd)} />
        <StatCard label="Positions" value={String(data.positionCount)} sub={`${data.matchedCount} on CuratorWatch`} />
        <StatCard label="Curators" value={String(data.curatorConcentration.length)} />
        <StatCard label="Rated exposure" value={`${data.ratedPct.toFixed(0)}%`} sub="of value attributed to a curator" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Positions table */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-background-elevated overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Positions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-text-tertiary font-mono border-b border-border-subtle">
                  <th className="px-4 py-2 font-medium">Position</th>
                  <th className="px-4 py-2 font-medium">Curator</th>
                  <th className="px-4 py-2 font-medium text-right">Value</th>
                  <th className="px-4 py-2 font-medium text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.positions.map((p, i) => (
                  <PositionRow key={i} p={p} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: curator concentration */}
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-background-elevated p-4">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Top curators</h2>
            <div className="space-y-2">
              {data.curatorConcentration.slice(0, 6).map((c) => (
                <div key={c.key} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/curator/${c.key}`}
                    className="text-text-secondary hover:text-accent-blue transition-colors truncate mr-2"
                  >
                    {c.label ?? shortAddr(c.key)}
                  </Link>
                  <span className="text-text-tertiary tabular-nums whitespace-nowrap">
                    {formatCurrency(c.netUsd)} · {c.pct.toFixed(0)}%
                  </span>
                </div>
              ))}
              {data.curatorConcentration.length === 0 && (
                <p className="text-xs text-text-tertiary">No positions attributed to a tracked curator.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity */}
      {data.activity.length > 0 && (
        <div className="rounded-lg border border-border bg-background-elevated overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Recent activity</h2>
          </div>
          <div className="divide-y divide-border-subtle">
            {data.activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <span className="capitalize text-text-secondary">{a.interaction}</span>
                  {a.tokenSymbol && <span className="text-text-tertiary font-mono">{a.tokenSymbol}</span>}
                </span>
                <span className="flex items-center gap-3">
                  {a.amountUsd != null && (
                    <span className="text-text-primary tabular-nums">{formatCurrency(a.amountUsd)}</span>
                  )}
                  {a.timestamp && <span className="text-text-tertiary text-xs">{formatTimeAgo(a.timestamp)}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-text-muted">
        Positions sourced from the Turtle Earn aggregator across protocols. Coverage and balances
        depend on that feed; positions not tracked by CuratorWatch show without a curator.
      </p>
    </div>
  );
}

function PositionRow({ p }: { p: EnrichedPosition }) {
  return (
    <tr className="border-b border-border-subtle last:border-0 hover:bg-background-hover/50 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-medium truncate max-w-[180px]">{p.name}</span>
        </div>
        <div className="text-xs text-text-tertiary mt-0.5">
          {p.protocolName}
          {p.chainId != null && <span> · {chainName(p.chainId)}</span>}
        </div>
      </td>
      <td className="px-4 py-2.5">
        {p.curatorAddress ? (
          <Link
            href={`/curator/${p.curatorAddress}`}
            className="text-text-secondary hover:text-accent-blue transition-colors inline-flex items-center gap-1"
          >
            {p.curatorName ?? shortAddr(p.curatorAddress)}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-text-muted text-xs">
            <ShieldQuestion className="w-3.5 h-3.5" />
            Not on CuratorWatch
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right text-text-primary tabular-nums">{formatCurrency(p.netUsd)}</td>
      <td className="px-4 py-2.5 text-right text-text-tertiary tabular-nums">{p.pct.toFixed(1)}%</td>
    </tr>
  );
}

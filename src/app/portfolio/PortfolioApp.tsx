"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Wallet, Search, ExternalLink, ShieldQuestion } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";
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

      <div className="space-y-1.5">
        {/* Address input */}
        <Panel title="Address" meta="any EVM wallet" bodyClassName="p-3">
          <div className="flex flex-col sm:flex-row gap-1.5">
            <form
              className="flex-1 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                loadAddress(input);
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" aria-hidden="true" />
                <input
                  aria-label="Wallet address"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="0x… paste any wallet address"
                  spellCheck={false}
                  className="field num pl-8 text-sm"
                />
              </div>
              <button type="submit" className="btn btn-primary h-[2.2rem]">
                View
              </button>
            </form>
            {wallet.available && (
              <button
                type="button"
                onClick={onConnect}
                disabled={wallet.connecting}
                className="btn btn-ghost h-[2.2rem]"
              >
                <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
                {wallet.connecting
                  ? "Connecting…"
                  : wallet.account
                    ? `Use ${shortAddr(wallet.account)}`
                    : "Connect wallet"}
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
        </Panel>

        {/* States */}
        {!activeAddress && !loading && <EmptyState />}
        {loading && (
          <Panel title="Positions" meta="loading" bodyClassName="px-3 py-6 text-center text-text-tertiary text-sm">
            Loading portfolio for <span className="num">{activeAddress ? shortAddr(activeAddress) : ""}</span>…
          </Panel>
        )}
        {!loading && data && data.positionCount === 0 && (
          <Panel title="Positions" meta="0" bodyClassName="px-3 py-6 text-center text-text-tertiary text-sm">
            No open DeFi positions found for <span className="num">{shortAddr(data.address)}</span>. Check the address, or try another wallet.
          </Panel>
        )}
        {!loading && data && data.positionCount > 0 && <Dashboard data={data} />}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Panel title="Positions" meta="no address yet" bodyClassName="px-3 py-6 text-center">
      <p className="text-text-secondary text-sm max-w-md mx-auto">
        Connect a wallet or paste any address to see its DeFi positions across protocols,
        joined to the curator managing each one.
      </p>
    </Panel>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-3 py-2.5 border-border border-r border-b lg:border-b-0 min-w-0">
      <dt className="label">{label}</dt>
      <dd className="num font-semibold text-[1.45rem] leading-none text-text-primary mt-1.5 truncate">{value}</dd>
      {sub && <dd className="text-xs text-text-tertiary mt-1">{sub}</dd>}
    </div>
  );
}

function Dashboard({ data }: { data: PortfolioData }) {
  return (
    <div className="space-y-1.5">
      {/* Summary */}
      <section aria-label="Portfolio summary" className="panel">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total value" value={formatCurrency(data.totalNetUsd)} />
          <StatCard label="Positions" value={String(data.positionCount)} sub={`${data.matchedCount} on CuratorWatch`} />
          <StatCard label="Curators" value={String(data.curatorConcentration.length)} />
          <StatCard label="Attributed exposure" value={`${data.ratedPct.toFixed(0)}%`} sub="of value attributed to a curator" />
        </dl>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5 items-start">
        {/* Positions table */}
        <Panel title="Positions" meta={String(data.positionCount)} className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background">
                <tr className="h-7 border-b border-border">
                  <th scope="col" className="label text-left px-3">Position</th>
                  <th scope="col" className="label text-left px-3">Curator</th>
                  <th scope="col" className="label text-right px-3">Value</th>
                  <th scope="col" className="label text-right px-3">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.positions.map((p, i) => (
                  <PositionRow key={i} p={p} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Right column: curator concentration */}
        <Panel title="Top curators" meta="by value">
          <div>
            {data.curatorConcentration.slice(0, 6).map((c) => (
              <div key={c.key} className="flex items-center justify-between h-8 px-3 border-b border-border-subtle last:border-0 text-sm">
                <Link
                  href={`/curator/${c.key}`}
                  className="text-text-secondary hover:text-accent-blue transition-colors truncate mr-2"
                >
                  {c.label ?? shortAddr(c.key)}
                </Link>
                <span className="num text-text-tertiary whitespace-nowrap">
                  {formatCurrency(c.netUsd)} · {c.pct.toFixed(0)}%
                </span>
              </div>
            ))}
            {data.curatorConcentration.length === 0 && (
              <p className="px-3 py-2.5 text-xs text-text-tertiary">No positions attributed to a tracked curator.</p>
            )}
          </div>
        </Panel>
      </div>

      {/* Activity */}
      {data.activity.length > 0 && (
        <Panel title="Recent activity" meta={String(data.activity.length)}>
          <div className="divide-y divide-border-subtle">
            {data.activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-3 h-8 text-sm">
                <span className="flex items-center gap-2">
                  <span className="capitalize text-text-secondary">{a.interaction}</span>
                  {a.tokenSymbol && <span className="num text-text-tertiary">{a.tokenSymbol}</span>}
                </span>
                <span className="flex items-center gap-3">
                  {a.amountUsd != null && (
                    <span className="num text-text-primary">{formatCurrency(a.amountUsd)}</span>
                  )}
                  {a.timestamp && <span className="num text-text-tertiary text-xs">{formatTimeAgo(a.timestamp)}</span>}
                </span>
              </div>
            ))}
          </div>
        </Panel>
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
    <tr className="border-b border-border-subtle last:border-0 hover:bg-background-hover transition-colors">
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-text-primary font-medium truncate max-w-[180px]">{p.name}</span>
        </div>
        <div className="text-xs text-text-tertiary">
          {p.protocolName}
          {p.chainId != null && <span> · {chainName(p.chainId)}</span>}
        </div>
      </td>
      <td className="px-3 py-1.5">
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
      <td className="px-3 py-1.5 num text-right text-text-primary">{formatCurrency(p.netUsd)}</td>
      <td className="px-3 py-1.5 num text-right text-text-tertiary">{p.pct.toFixed(1)}%</td>
    </tr>
  );
}

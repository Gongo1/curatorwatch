"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, ArrowLeft, ChevronRight } from "lucide-react";
import {
  getOpportunity,
  chainLabel,
  isDepositable,
  TURTLE_DISTRIBUTOR_ID,
  type EarnOpportunity,
} from "@/lib/turtle/earn-client";
import { useEthereum, chainName } from "@/lib/turtle/useEthereum";
import { useTurtleMembership } from "@/lib/turtle/useMembership";
import { DepositPanel } from "@/app/deposit/DepositPanel";
import { formatCurrency } from "@/lib/utils/format";

export interface DealContext {
  opportunityId: string;
  vaultName: string;
  curatorName?: string | null;
  assetSymbol?: string | null;
  estApr?: number | null;
  tvl?: number | null;
}

function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

// The deposit flow as a drawer, openable from any deal entry point.
// - One deal (vault page, a curator's Deal link) → straight to the deposit panel.
// - Many deals (a curator's "Deposit into this curator" CTA) → a picker first,
//   then the deposit panel for the chosen opportunity.
// Mounted only when open; next/dynamic at the call sites keeps the wallet/deposit
// chunk out of page bundles until first use.
export function DealDepositDrawer({
  deals,
  curatorName,
  onClose,
}: {
  deals: DealContext[];
  curatorName?: string | null;
  onClose: () => void;
}) {
  const wallet = useEthereum();
  const membership = useTurtleMembership(wallet);
  // Auto-select when there's only one deal; otherwise show the picker first.
  const [selectedId, setSelectedId] = useState<string | null>(
    deals.length === 1 ? deals[0].opportunityId : null
  );
  const [opp, setOpp] = useState<EarnOpportunity | null>(null);
  const [oppError, setOppError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = deals.find((d) => d.opportunityId === selectedId) ?? null;
  const showPicker = selected === null;

  // Fresh opportunity (tokens, depositability) for the selected deal — the
  // mapping row may be up to 12h old; the deposit must be built against live data.
  useEffect(() => {
    if (!selectedId) {
      setOpp(null);
      setOppError(null);
      return;
    }
    let active = true;
    setOpp(null);
    setOppError(null);
    getOpportunity(selectedId)
      .then((o) => {
        if (active) setOpp(o);
      })
      .catch((e) => {
        if (active)
          setOppError(e instanceof Error ? e.message : "Could not load this deal");
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  // Esc closes; lock body scroll while open; move focus into the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const token = opp?.depositTokens?.[0];
  const steps: { label: string; state: "done" | "active" | "todo" }[] = [
    { label: "Connect wallet", state: wallet.account ? "done" : "active" },
    {
      label: "Join Turtle (sign)",
      state: membership.member === true ? "done" : wallet.account ? "active" : "todo",
    },
    {
      label: "Approve & deposit",
      state: wallet.account && membership.member === true ? "active" : "todo",
    },
  ];

  const headerTitle = showPicker
    ? `Deposit with ${curatorName ?? "this curator"}`
    : selected.vaultName;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
    >
      <button
        type="button"
        aria-label="Close deposit panel"
        onClick={onClose}
        className="absolute inset-0 w-full h-full bg-black/60 cursor-default"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute right-0 top-0 h-full w-full max-w-[440px] bg-background border-l border-border shadow-2xl overflow-y-auto outline-none"
      >
        {/* ── Header ── */}
        <div className="p-5 border-b border-border sticky top-0 bg-background z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-cyan-500">
                Deposit · attributed to CuratorWatch
              </div>
              {!showPicker && deals.length > 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-text-tertiary hover:text-text-primary transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" /> All {deals.length} deals
                </button>
              )}
              <h2 className="font-display font-bold text-xl tracking-tight mt-1 truncate">
                {headerTitle}
              </h2>
              {showPicker ? (
                <div className="font-mono text-xs text-text-secondary mt-1">
                  {deals.length} depositable {deals.length === 1 ? "opportunity" : "opportunities"} · pick one to fund
                </div>
              ) : (
                <div className="font-mono text-xs text-text-secondary mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                  {selected.curatorName && <span>{selected.curatorName}</span>}
                  {selected.curatorName && <span className="text-text-muted">·</span>}
                  <span>
                    {token?.symbol ?? selected.assetSymbol ?? "—"}
                    {token && chainLabel(token) ? ` on ${chainLabel(token)}` : ""}
                  </span>
                  {selected.estApr != null && (
                    <>
                      <span className="text-text-muted">·</span>
                      <span className="text-accent-green">
                        est. {selected.estApr.toFixed(1)}% APR
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-text-tertiary hover:text-text-primary transition-colors flex-none mt-0.5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Screen 1: pick an opportunity ── */}
        {showPicker && (
          <div className="p-5 space-y-2">
            {deals.map((d) => (
              <button
                key={d.opportunityId}
                type="button"
                onClick={() => setSelectedId(d.opportunityId)}
                className="w-full flex items-center justify-between gap-3 p-3.5 text-left bg-background-subtle border border-border rounded-xl hover:border-cyan-500/40 hover:bg-background-hover transition-colors group"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text-primary truncate">
                    {d.vaultName}
                  </span>
                  <span className="block font-mono text-[0.65rem] text-text-tertiary mt-0.5">
                    {d.assetSymbol ?? "—"}
                    {d.tvl != null ? ` · ${formatCurrency(d.tvl)} TVL` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2 flex-none">
                  {d.estApr != null && (
                    <span className="font-mono text-xs text-accent-green tabular-nums">
                      {d.estApr.toFixed(1)}%
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-cyan-500 transition-colors" />
                </span>
              </button>
            ))}
            <p className="font-mono text-[0.65rem] text-text-tertiary leading-relaxed pt-2">
              Every deposit is attributed on-chain to CuratorWatch
              {TURTLE_DISTRIBUTOR_ID ? ` (${TURTLE_DISTRIBUTOR_ID})` : ""}. APRs are
              the deal&rsquo;s latest estimate from Turtle.
            </p>
          </div>
        )}

        {/* ── Screen 2: deposit flow for the selected deal ── */}
        {!showPicker && (
          <div className="p-5 space-y-5">
            {/* Steps */}
            <ol className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-wide">
              {steps.map((s, i) => (
                <li key={s.label} className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex-none w-4 h-4 rounded-full grid place-items-center text-[0.6rem] ${
                      s.state === "done"
                        ? "bg-cyan-500 text-[#06120f]"
                        : s.state === "active"
                          ? "border border-cyan-500 text-cyan-500"
                          : "border border-border text-text-tertiary"
                    }`}
                  >
                    {s.state === "done" ? "✓" : i + 1}
                  </span>
                  <span
                    className={`truncate ${
                      s.state === "todo" ? "text-text-tertiary" : "text-text-secondary"
                    }`}
                  >
                    {s.label}
                  </span>
                  {i < steps.length - 1 && (
                    <span className="w-4 h-px bg-border flex-none" />
                  )}
                </li>
              ))}
            </ol>

            {/* Wallet state */}
            {!wallet.available && (
              <div className="p-4 bg-background-subtle border border-border rounded-xl text-sm text-text-secondary space-y-2">
                <p>
                  No Ethereum wallet detected in this browser. Depositing needs a
                  wallet extension such as{" "}
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-500 underline underline-offset-2"
                  >
                    MetaMask
                  </a>
                  .
                </p>
                <p className="text-xs text-text-tertiary">
                  On mobile, open curatorwatch.com inside your wallet app&rsquo;s
                  browser. You can keep researching — this deal stays on the{" "}
                  <Link
                    href={`/deposit?opportunity=${selected.opportunityId}`}
                    className="text-cyan-500 underline underline-offset-2"
                  >
                    deposit page
                  </Link>
                  .
                </p>
              </div>
            )}

            {wallet.available && !wallet.account && (
              <button
                onClick={() => wallet.connect()}
                disabled={wallet.connecting}
                className="w-full text-sm font-medium px-4 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
              >
                {wallet.connecting ? "Connecting…" : "Connect Wallet"}
              </button>
            )}

            {wallet.account && (
              <div className="flex items-center justify-between gap-3 p-3 bg-background-subtle border border-border rounded-xl">
                <span className="flex items-center gap-2 text-sm min-w-0">
                  <span className="inline-block w-2 h-2 bg-cyan-500 rounded-full flex-none" />
                  <span className="font-mono text-text-primary truncate">
                    {shortAddr(wallet.account)}
                  </span>
                  <span className="text-text-tertiary flex-none">·</span>
                  <span className="text-text-secondary flex-none">
                    {chainName(wallet.chainId)}
                  </span>
                </span>
                {membership.member === false && (
                  <button
                    onClick={membership.join}
                    disabled={membership.joining}
                    className="flex-none text-sm font-medium px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
                  >
                    {membership.joining ? "Signing…" : "Join Turtle"}
                  </button>
                )}
                {membership.member === null && (
                  <span className="flex-none font-mono text-[0.65rem] text-text-tertiary">
                    checking…
                  </span>
                )}
                {membership.member === true && (
                  <span className="flex-none font-mono text-[0.65rem] text-cyan-500 font-semibold">
                    Member ✓
                  </span>
                )}
              </div>
            )}

            {(wallet.error || membership.message) && (
              <p className="text-sm text-accent-red">
                {wallet.error || membership.message}
              </p>
            )}

            {/* Deposit */}
            {oppError && (
              <div className="p-4 bg-background-subtle border border-border rounded-xl text-sm text-text-secondary">
                {oppError} — try the{" "}
                <Link href="/deposit" className="text-cyan-500 underline underline-offset-2">
                  deposit page
                </Link>
                .
              </div>
            )}
            {!opp && !oppError && (
              <div className="h-24 bg-background-subtle border border-border rounded-xl animate-pulse" />
            )}
            {opp && !isDepositable(opp) && (
              <div className="p-4 bg-background-subtle border border-border rounded-xl text-sm text-text-secondary">
                This deal is not currently depositable through the API.
              </div>
            )}
            {opp && isDepositable(opp) && (
              <DepositPanel opportunity={opp} wallet={wallet} member={membership.member} />
            )}

            <p className="font-mono text-[0.65rem] text-text-tertiary leading-relaxed">
              Deposits route through the Turtle Earn API and are attributed
              on-chain to CuratorWatch
              {TURTLE_DISTRIBUTOR_ID ? ` (${TURTLE_DISTRIBUTOR_ID})` : ""}. Track
              them on the{" "}
              <Link href="/deposit" className="text-cyan-500 underline underline-offset-2">
                deposit page
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

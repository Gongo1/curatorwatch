import type { Metadata } from "next";
import Link from "next/link";
import { fetchFeesOverview } from "@/lib/lens-overviews";
import { formatCurrency } from "@/lib/utils/format";

// ISR aligned to the ingestion cadence, like /yields.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Fees - CuratorWatch",
  description:
    "What curators charge across the ecosystem: total annualized curator fees, the fee-rate distribution, and which curators earn the most in fees.",
};

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

const TOP_N = 15;

// The fees lens, curator-first: one executive summary of what curators charge
// across the whole ecosystem — no per-vault table.
export default async function FeesPage() {
  const o = await fetchFeesOverview();
  const top = o.rows.slice(0, TOP_N);
  const rest = o.rows.slice(TOP_N);
  const restFees = rest.reduce((s, r) => s + r.annualFees, 0);
  const maxFee = top[0]?.annualFees || 1;
  const topShare =
    o.totalAnnualFees > 0 ? ((o.totalAnnualFees - restFees) / o.totalAnnualFees) * 100 : 0;
  const maxBand = Math.max(1, ...o.feeBands.map((b) => b.vaults));
  const maxBandTvl = Math.max(1, ...o.feeBands.map((b) => b.tvl));

  return (
    <div className="max-w-[1000px]">
      {/* ── Executive summary ── */}
      <header className="mb-8">
        <div className="font-mono text-xs uppercase tracking-[0.12em] text-text-tertiary">
          Annualized curator fees · whole tracked ecosystem
        </div>
        <div className="font-mono font-semibold text-[clamp(2.6rem,7vw,4.2rem)] leading-[0.98] tracking-[-0.03em] tabular-nums my-2">
          {compactUsd(o.totalAnnualFees)}
        </div>
        <div className="font-mono text-sm text-text-secondary">
          charged by <span className="text-text-primary font-semibold">{o.curatorsCharging}</span>{" "}
          fee-earning curators
          <span className="text-text-muted mx-2">·</span>
          median performance fee{" "}
          <span className="text-text-primary font-semibold">
            {(o.medianPerfFee * 100).toFixed(0)}%
          </span>
        </div>
      </header>

      {/* ── Fee-rate distribution (fee-charging vaults only) ── */}
      <section className="border border-border rounded-2xl bg-background-subtle p-6 mb-10 max-w-[640px]">
        <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary mb-4">
          Performance-fee distribution · fee-charging vaults · shade = TVL
        </div>
        <div className="flex gap-3 h-32">
          {o.feeBands.map((b) => (
            <div key={b.label} className="flex-1 flex flex-col items-center min-w-0">
              <span className="font-mono text-xs text-text-secondary tabular-nums mb-1">{b.vaults}</span>
              <div className="flex-1 w-full flex items-end justify-center">
                <div
                  className="w-full max-w-[44px] rounded-t bg-accent-blue"
                  style={{
                    height: `${b.vaults > 0 ? Math.max(3, (b.vaults / maxBand) * 100) : 0}%`,
                    opacity: 0.3 + 0.7 * (b.tvl / maxBandTvl),
                  }}
                  title={`${b.label}: ${b.vaults} vaults · ${compactUsd(b.tvl)} TVL`}
                />
              </div>
              <span className="font-mono text-[0.62rem] text-text-tertiary tabular-nums mt-2">{b.label}</span>
            </div>
          ))}
        </div>
        <p className="font-mono text-xs text-text-tertiary mt-5 leading-relaxed">
          Of {o.totalVaults} curated vaults, <span className="text-text-secondary">{o.zeroFeeVaults}</span> charge
          no performance fee (mostly large passthrough savings vaults); the bands
          above are the {o.curatorsCharging > 0 ? o.feeBands.reduce((s, b) => s + b.vaults, 0) : 0} that do.
          A single &ldquo;average fee&rdquo; hides this spread.
        </p>
      </section>

      {/* ── Who earns the most in fees ── */}
      <section>
        <div className="flex items-baseline gap-3 mb-5 pb-3 border-b border-border flex-wrap">
          <span className="w-[7px] h-[7px] rounded-sm bg-accent-blue -translate-y-0.5" />
          <span className="font-display font-bold text-xl tracking-tight">
            Who earns the most in fees
          </span>
          <span className="font-mono text-xs text-text-tertiary ml-auto text-right">
            annualized · top {top.length} = {Math.round(topShare)}% of the total
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {top.map((r, i) => (
            <div
              key={r.address}
              className="grid grid-cols-[28px_180px_1fr_210px] max-sm:grid-cols-[28px_1fr_120px] gap-4 items-center"
            >
              <span className="font-mono text-xs text-text-tertiary tabular-nums">{i + 1}</span>
              <Link
                href={`/curator/${r.address}`}
                className="text-sm text-text-primary hover:text-accent-blue transition-colors truncate font-medium"
                title={r.name}
              >
                {r.name}
              </Link>
              <div className="h-[18px] rounded bg-background-elevated overflow-hidden max-sm:hidden">
                <span
                  className="block h-full"
                  style={{
                    width: `${(r.annualFees / maxFee) * 100}%`,
                    background: "var(--accent-blue)",
                    opacity: 0.85,
                  }}
                />
              </div>
              <span className="font-mono text-xs text-text-secondary text-right tabular-nums">
                <b className="text-text-primary font-semibold">{formatCurrency(r.annualFees)}/yr</b>{" "}
                <span className="text-text-tertiary">
                  · {(r.avgPerfFee * 100).toFixed(0)}% on {compactUsd(r.tvl)}
                </span>
              </span>
            </div>
          ))}
        </div>
        {rest.length > 0 && (
          <p className="font-mono text-xs text-text-tertiary mt-4">
            + {rest.length} more fee-earning curators charging {formatCurrency(restFees)}/yr between them.
          </p>
        )}
        <p className="font-mono text-xs text-text-tertiary mt-2 leading-relaxed">
          Annualized from the latest 6h snapshot: per vault,{" "}
          <span className="text-text-secondary">TVL × management fee + TVL × gross APY × performance fee</span>,
          summed per curator. Curators charging nothing are omitted. Open a curator
          for the per-vault fee breakdown.
        </p>
      </section>
    </div>
  );
}

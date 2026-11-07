import type { Metadata } from "next";
import Link from "next/link";
import { fetchFeesOverview } from "@/lib/lens-overviews";
import { formatCurrency } from "@/lib/utils/format";
import { curatorSlug } from "@/lib/curator-aliases";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";
import { Quote } from "@/components/layout/Quote";

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

  const chargingVaults = o.feeBands.reduce((s, b) => s + b.vaults, 0);

  return (
    <div className="space-y-1.5">
      <PageHeader
        title="Fees"
        description="What curators charge across the ecosystem: annualized curator fees, the fee-rate spread, and which curators earn the most."
      />

      {/* ── Quote line: the fee summary in one row ── */}
      <section aria-label="Fee summary" className="panel">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <Quote k="Annualized curator fees" v={compactUsd(o.totalAnnualFees)} lead />
          <Quote k="Median performance fee" v={`${(o.medianPerfFee * 100).toFixed(0)}%`} />
          <Quote k="Fee-earning curators" v={String(o.curatorsCharging)} />
          <Quote k="Zero-fee vaults" v={String(o.zeroFeeVaults)} sub={`of ${o.totalVaults}`} />
          <Quote k={`Top ${top.length} share`} v={`${Math.round(topShare)}%`} sub="of fees" />
        </dl>
      </section>

      <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_23rem] items-start">
        {/* ── Who earns the most in fees ── */}
        <Panel title="Who earns the most in fees" meta={`annualized · top ${top.length}`}>
          <table className="w-full text-sm table-fixed">
            <caption className="sr-only">Curators ranked by annualized fee revenue</caption>
            <thead>
              <tr className="h-7 border-b border-border bg-background">
                <th scope="col" className="label text-right w-9 pr-3">#</th>
                <th scope="col" className="label text-left">Curator</th>
                <th scope="col" className="label text-left hidden md:table-cell w-[30%] pl-3">
                  <span className="sr-only">Share of top fees</span>
                </th>
                <th scope="col" className="label text-right w-[6.5rem] sm:w-[7.5rem]">Fees / yr</th>
                <th scope="col" className="label text-right w-[4.5rem] pr-3 sm:pr-0" title="Average performance fee">Perf fee</th>
                <th scope="col" className="label text-right w-[5.5rem] pr-3 hidden sm:table-cell">TVL</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r, i) => (
                <tr key={r.address} className="h-8 border-b border-border-subtle hover:bg-background-hover">
                  <td className="num text-xs text-text-tertiary text-right pr-3">{i + 1}</td>
                  <td className="truncate">
                    <Link
                      href={`/curator/${curatorSlug(r.name, r.address)}`}
                      className="font-medium text-text-primary hover:text-accent-blue transition-colors"
                      title={r.name}
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td className="hidden md:table-cell pl-3 pr-2">
                    <div className="h-2.5 bg-background" aria-hidden="true">
                      <span
                        className="block h-full bg-accent-blue"
                        style={{ width: `${(r.annualFees / maxFee) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="num text-right font-semibold text-text-primary">
                    {formatCurrency(r.annualFees)}
                  </td>
                  <td className="num text-right text-text-secondary pr-3 sm:pr-0">{(r.avgPerfFee * 100).toFixed(0)}%</td>
                  <td className="num text-right text-text-tertiary pr-3 hidden sm:table-cell">
                    {compactUsd(r.tvl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 space-y-1 text-xs text-text-tertiary leading-relaxed">
            {rest.length > 0 && (
              <p>
                + <span className="num">{rest.length}</span> more fee-earning curators charging{" "}
                <span className="num text-text-secondary">{formatCurrency(restFees)}/yr</span> between them.
              </p>
            )}
            <p>
              Annualized from the latest 6h snapshot: per vault,{" "}
              <span className="text-text-secondary">TVL × management fee + TVL × gross APY × performance fee</span>,
              summed per curator. Curators charging nothing are omitted. Open a curator
              for the per-vault fee breakdown.
            </p>
          </div>
        </Panel>

        {/* ── Fee-rate distribution (fee-charging vaults only) ── */}
        <Panel title="Performance-fee spread" meta={`${chargingVaults} vaults · shade = TVL`} bodyClassName="p-3">
          <div className="flex gap-1.5 h-32" role="img" aria-label="Fee-charging vault count by performance-fee band">
            {o.feeBands.map((b) => (
              <div key={b.label} className="flex-1 flex flex-col items-center min-w-0">
                <span className="num text-xs text-text-secondary mb-1">{b.vaults}</span>
                <div className="flex-1 w-full flex items-end justify-center border-b border-border">
                  <div
                    className="w-full max-w-[44px] bg-accent-blue"
                    style={{
                      height: `${b.vaults > 0 ? Math.max(3, (b.vaults / maxBand) * 100) : 0}%`,
                      opacity: 0.3 + 0.7 * (b.tvl / maxBandTvl),
                    }}
                    title={`${b.label}: ${b.vaults} vaults · ${compactUsd(b.tvl)} TVL`}
                  />
                </div>
                <span className="num text-[10px] text-text-tertiary mt-1.5">{b.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-tertiary mt-3 leading-relaxed">
            Of <span className="num">{o.totalVaults}</span> curated vaults,{" "}
            <span className="num text-text-secondary">{o.zeroFeeVaults}</span> charge no performance fee
            (mostly large passthrough savings vaults); the bands above are the{" "}
            <span className="num">{o.curatorsCharging > 0 ? chargingVaults : 0}</span> that do. A single
            &ldquo;average fee&rdquo; hides this spread.
          </p>
        </Panel>
      </div>
    </div>
  );
}


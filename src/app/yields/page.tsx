import type { Metadata } from "next";
import Link from "next/link";
import { fetchAllDashboardData } from "@/lib/dashboard-queries";
import { ApyDistViz } from "@/components/ApyDistViz";
import { formatCurrency } from "@/lib/utils/format";
import { curatorSlug } from "@/lib/curator-aliases";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";
import { Quote } from "@/components/layout/Quote";

// ISR aligned to the ingestion cadence, like the home page: the cron
// revalidates this path on completion; 6h is the fallback ceiling.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Yields - CuratorWatch",
  description:
    "How much yield curated DeFi vaults pay LPs: ecosystem-wide annual yield, the net-APY distribution, and which curators pay out the most.",
};

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

const TOP_N = 15;

// The yields lens, curator-first: one executive summary of what the curated
// ecosystem pays LPs — no vault/curator tab split, no per-source split.
export default async function YieldsPage() {
  const data = await fetchAllDashboardData({
    page: 1,
    pageSize: 100,
    sortBy: "aum",
    sortOrder: "desc",
  });
  const { curators, stats } = data.curators.data;
  const dist = data.apyDistribution ?? null;

  const rows = curators
    .map((c) => ({
      address: c.curatorAddress,
      name: c.name || `Curator ${c.curatorAddress.slice(0, 6)}`,
      aum: c.totalAUM,
      apy: c.avgNetApy,
      vaults: c.vaultCount,
      annualYield: c.totalAUM * c.avgNetApy,
    }))
    .filter((r) => r.annualYield > 0)
    .sort((a, b) => b.annualYield - a.annualYield);

  const totalYield = rows.reduce((s, r) => s + r.annualYield, 0);
  const weightedApy = stats.totalAUM > 0 ? totalYield / stats.totalAUM : 0;
  const top = rows.slice(0, TOP_N);
  const rest = rows.slice(TOP_N);
  const restYield = rest.reduce((s, r) => s + r.annualYield, 0);
  const maxYield = top[0]?.annualYield || 1;
  const topShare = totalYield > 0 ? ((totalYield - restYield) / totalYield) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <PageHeader
        title="Yields"
        description="What the curated ecosystem pays LPs: annual yield, the net-APY spread, and which curators pay out the most."
      />

      {/* ── Quote line: the yield summary in one row ── */}
      <section aria-label="Yield summary" className="panel">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <Quote k="Annual yield to LPs" v={compactUsd(totalYield)} />
          <Quote k="TVL-weighted net APY" v={`${(weightedApy * 100).toFixed(2)}%`} />
          <Quote k="Yield-generating curators" v={String(rows.length)} />
          <Quote k="Vaults" v={String(stats.totalVaults)} />
          <Quote k={`Top ${top.length} share`} v={`${Math.round(topShare)}%`} sub="of yield" />
        </dl>
      </section>

      <div className="grid gap-1.5 lg:grid-cols-[minmax(0,1fr)_23rem] items-start">
        {/* ── Who pays the most ── */}
        <Panel title="Who pays the most" meta={`annual $ yield · top ${top.length}`}>
          <table className="w-full text-sm table-fixed">
            <caption className="sr-only">Curators ranked by annual yield paid to LPs</caption>
            <thead>
              <tr className="h-7 border-b border-border bg-background">
                <th scope="col" className="label text-right w-9 pr-3">#</th>
                <th scope="col" className="label text-left">Curator</th>
                <th scope="col" className="label text-left hidden md:table-cell w-[30%] pl-3">
                  <span className="sr-only">Share of top yield</span>
                </th>
                <th scope="col" className="label text-right w-[6.5rem] sm:w-[7.5rem]">Annual yield</th>
                <th scope="col" className="label text-right w-[4.5rem] pr-3 sm:pr-0">Net APY</th>
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
                        style={{ width: `${(r.annualYield / maxYield) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="num text-right font-semibold text-text-primary">
                    {formatCurrency(r.annualYield)}
                  </td>
                  <td className="num text-right text-text-secondary pr-3 sm:pr-0">{(r.apy * 100).toFixed(1)}%</td>
                  <td className="num text-right text-text-tertiary pr-3 hidden sm:table-cell">
                    {compactUsd(r.aum)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 space-y-1 text-xs text-text-tertiary leading-relaxed">
            {rest.length > 0 && (
              <p>
                + <span className="num">{rest.length}</span> more curators paying{" "}
                <span className="num text-text-secondary">{formatCurrency(restYield)}</span> between them.
              </p>
            )}
            <p>
              Annualized from the latest 6h snapshot: each curator&rsquo;s TVL × its
              TVL-weighted net APY, across every tracked vault regardless of source.
              Open a curator for the per-vault breakdown.
            </p>
          </div>
        </Panel>

        {/* ── Distribution: the honest version of "what's the APY?" ── */}
        {dist && dist.count > 0 && (
          <Panel title="Net APY spread" meta={`${dist.count} vaults`} bodyClassName="p-3">
            <ApyDistViz d={dist} tall label="Vault count by net APY band" />
            <p className="text-xs text-text-tertiary mt-3 leading-relaxed">
              Most curated TVL clusters in the bright bands; the long tail is real
              but thin. A single average hides this. The distribution is the
              number that matters.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}


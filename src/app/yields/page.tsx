import type { Metadata } from "next";
import Link from "next/link";
import { fetchAllDashboardData } from "@/lib/dashboard-queries";
import { ApyDistViz } from "@/components/ApyDistViz";
import { formatCurrency } from "@/lib/utils/format";
import { curatorSlug } from "@/lib/curator-aliases";

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
    <div className="max-w-[1000px]">
      {/* ── Executive summary ── */}
      <header className="mb-8">
        <div className="font-mono text-xs uppercase tracking-[0.12em] text-text-tertiary">
          Annual yield to LPs · whole tracked ecosystem
        </div>
        <div className="font-mono font-semibold text-[clamp(2.6rem,7vw,4.2rem)] leading-[0.98] tracking-[-0.03em] tabular-nums my-2">
          {compactUsd(totalYield)}
        </div>
        <div className="font-mono text-sm text-text-secondary">
          paid by <span className="text-text-primary font-semibold">{rows.length}</span>{" "}
          yield-generating curators
          <span className="text-text-muted mx-2">·</span>
          <span className="text-text-primary font-semibold">{stats.totalVaults}</span> vaults
          <span className="text-text-muted mx-2">·</span>
          TVL-weighted net APY{" "}
          <span className="text-accent-green font-semibold">
            {(weightedApy * 100).toFixed(2)}%
          </span>
        </div>
      </header>

      {/* ── Distribution: the honest version of "what's the APY?" ── */}
      {dist && dist.count > 0 && (
        <section className="border border-border rounded-2xl bg-background-subtle p-6 mb-10 max-w-[560px]">
          <ApyDistViz d={dist} tall label={`Net APY distribution · ${dist.count} vaults`} />
          <p className="font-mono text-xs text-text-tertiary mt-4 leading-relaxed">
            Most curated TVL clusters in the bright bands; the long tail is real
            but thin. A single average hides this — the distribution is the
            number that matters.
          </p>
        </section>
      )}

      {/* ── Who pays the most ── */}
      <section>
        <div className="flex items-baseline gap-3 mb-5 pb-3 border-b border-border flex-wrap">
          <span className="w-[7px] h-[7px] rounded-sm bg-accent-blue -translate-y-0.5" />
          <span className="font-display font-bold text-xl tracking-tight">
            Who pays the most
          </span>
          <span className="font-mono text-xs text-text-tertiary ml-auto text-right">
            annual $ yield · top {top.length} = {Math.round(topShare)}% of the total
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {top.map((r, i) => (
            <div
              key={r.address}
              className="grid grid-cols-[28px_180px_1fr_200px] max-sm:grid-cols-[28px_1fr_120px] gap-4 items-center"
            >
              <span className="font-mono text-xs text-text-tertiary tabular-nums">
                {i + 1}
              </span>
              <Link
                href={`/curator/${curatorSlug(r.name, r.address)}`}
                className="text-sm text-text-primary hover:text-accent-blue transition-colors truncate font-medium"
                title={r.name}
              >
                {r.name}
              </Link>
              <div className="h-[18px] rounded bg-background-elevated overflow-hidden max-sm:hidden">
                <span
                  className="block h-full"
                  style={{
                    width: `${(r.annualYield / maxYield) * 100}%`,
                    background: "var(--accent-blue)",
                    opacity: 0.85,
                  }}
                />
              </div>
              <span className="font-mono text-xs text-text-secondary text-right tabular-nums">
                <b className="text-text-primary font-semibold">
                  {formatCurrency(r.annualYield)}
                </b>{" "}
                <span className="text-accent-green">{(r.apy * 100).toFixed(1)}%</span>{" "}
                <span className="text-text-tertiary">· {compactUsd(r.aum)}</span>
              </span>
            </div>
          ))}
        </div>
        {rest.length > 0 && (
          <p className="font-mono text-xs text-text-tertiary mt-4">
            + {rest.length} more curators paying {formatCurrency(restYield)} between them.
          </p>
        )}
        <p className="font-mono text-xs text-text-tertiary mt-2 leading-relaxed">
          Annualized from the latest 6h snapshot: each curator&rsquo;s TVL × its
          TVL-weighted net APY, across every tracked vault regardless of source.
          Open a curator for the per-vault breakdown.
        </p>
      </section>
    </div>
  );
}

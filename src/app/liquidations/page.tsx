import type { Metadata } from "next";
import { fetchLiquidationsOverview } from "@/lib/lens-overviews";
import { LiquidationsChart } from "./liquidations-chart";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";
import { Quote } from "@/components/layout/Quote";

// ISR aligned to the ingestion cadence, like /yields.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Liquidations - CuratorWatch",
  description:
    "Ecosystem liquidation activity over the last 180 days: total events, collateral seized, bad debt, and the daily seized-collateral timeline.",
};

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

const WINDOW = 180;

// The liquidations lens as a time series — ecosystem-wide health, not a
// curator ranking. How much is being liquidated, how often, and whether any
// of it turned into bad debt.
export default async function LiquidationsPage() {
  const o = await fetchLiquidationsOverview(WINDOW);
  const activeDays = o.series.filter((d) => d.events > 0).length;

  return (
    <div className="space-y-1.5">
      <PageHeader
        title="Liquidations"
        description={`Ecosystem liquidation activity over the last ${WINDOW} days: how much is liquidated, how often, and whether any of it turned into bad debt.`}
      />

      {/* ── Quote line: the window in one row ── */}
      <section aria-label="Liquidation summary" className="panel">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <Quote k="Collateral seized" v={compactUsd(o.totalSeizedUsd)} sub={`${WINDOW}d`} lead />
          <Quote k="Events" v={o.totalEvents.toLocaleString()} sub={`${WINDOW}d`} />
          <Quote k="Active days" v={String(activeDays)} sub={`of ${WINDOW}`} />
          <Quote k="Debt repaid" v={compactUsd(o.totalRepaidUsd)} />
          <Quote
            k="Bad debt"
            v={o.totalBadDebtUsd > 0 ? compactUsd(o.totalBadDebtUsd) : "None"}
            sub={o.totalBadDebtUsd > 0 ? `${o.daysWithBadDebt}d` : undefined}
            tone={o.totalBadDebtUsd > 0 ? "down" : "up"}
          />
        </dl>
      </section>

      {/* ── Daily seized timeline ── */}
      <Panel
        title="Daily collateral seized"
        meta={
          <>
            {WINDOW} days · hover any day · <span className="text-accent-red">●</span> bad debt
          </>
        }
        bodyClassName="p-3"
      >
        <LiquidationsChart series={o.series} />
        <p className="text-xs text-text-tertiary mt-2 leading-relaxed max-w-[90ch]">
          Each bar is the USD value of collateral seized that day across all tracked
          markets; the red dot marks days that produced bad debt (a loss to lenders).
          Healthy liquidations repay lenders in full and leave no bad debt.
        </p>
      </Panel>
    </div>
  );
}


import type { Metadata } from "next";
import { fetchLiquidationsOverview } from "@/lib/lens-overviews";
import { LiquidationsChart } from "./liquidations-chart";

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
    <div className="max-w-[1000px]">
      {/* ── Executive summary ── */}
      <header className="mb-8">
        <div className="font-mono text-xs uppercase tracking-[0.12em] text-text-tertiary">
          Collateral seized in liquidations · last {WINDOW} days
        </div>
        <div className="font-mono font-semibold text-[clamp(2.6rem,7vw,4.2rem)] leading-[0.98] tracking-[-0.03em] tabular-nums my-2">
          {compactUsd(o.totalSeizedUsd)}
        </div>
        <div className="font-mono text-sm text-text-secondary">
          across <span className="text-text-primary font-semibold">{o.totalEvents.toLocaleString()}</span>{" "}
          liquidation events
          <span className="text-text-muted mx-2">·</span>
          on <span className="text-text-primary font-semibold">{activeDays}</span> of {WINDOW} days
        </div>
      </header>

      {/* ── Stat strip ── */}
      <div className="flex gap-x-12 gap-y-4 flex-wrap py-4 border-y border-border-subtle mb-8">
        <Stat k="Events" v={o.totalEvents.toLocaleString()} sub={`${WINDOW}d`} />
        <Stat k="Collateral seized" v={compactUsd(o.totalSeizedUsd)} />
        <Stat k="Debt repaid" v={compactUsd(o.totalRepaidUsd)} />
        <div>
          <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary">
            Bad debt
          </div>
          <div
            className={`font-mono font-semibold text-xl tracking-tight mt-0.5 tabular-nums ${
              o.totalBadDebtUsd > 0 ? "text-accent-red" : "text-accent-green"
            }`}
          >
            {o.totalBadDebtUsd > 0 ? compactUsd(o.totalBadDebtUsd) : "None"}
            {o.totalBadDebtUsd > 0 && (
              <span className="text-xs text-text-tertiary font-normal ml-1.5">
                {o.daysWithBadDebt}d
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Daily seized timeline ── */}
      <section>
        <div className="flex items-baseline gap-3 mb-5 pb-3 border-b border-border flex-wrap">
          <span className="w-[7px] h-[7px] rounded-sm bg-accent-blue -translate-y-0.5" />
          <span className="font-display font-bold text-xl tracking-tight">
            Daily collateral seized
          </span>
          <span className="font-mono text-xs text-text-tertiary ml-auto text-right">
            {WINDOW} days · hover any day · <span className="text-accent-red">●</span> = bad debt
          </span>
        </div>
        <LiquidationsChart series={o.series} />
        <p className="font-mono text-xs text-text-tertiary mt-3 leading-relaxed">
          Each bar is the USD value of collateral seized that day across all tracked
          markets; the red dot marks days that produced bad debt (a loss to lenders).
          Healthy liquidations repay lenders in full and leave no bad debt.
        </p>
      </section>
    </div>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div>
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary">{k}</div>
      <div className="font-mono font-semibold text-xl tracking-tight mt-0.5 tabular-nums">
        {v}
        {sub && <span className="text-xs text-text-tertiary font-normal ml-1.5">{sub}</span>}
      </div>
    </div>
  );
}

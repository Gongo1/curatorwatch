import type { Metadata } from "next";
import Link from "next/link";
import { getAllCuratorRatings, RISK_GRADES_ENABLED } from "@/lib/curator-engine-rating";
import { gradeColor, fmtBps, GRADE_BLURB } from "@/lib/grade-style";
import { curatorSlug } from "@/lib/curator-aliases";
import { BacktestPanel } from "@/components/BacktestPanel";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Ratings - CuratorWatch",
  description:
    "Loss-anchored Expected-Loss grades for every rated curator: one executive summary of who is safest to entrust capital to, and who isn't.",
};

const GRADE_ORDER = ["A+", "A", "B+", "B", "C+", "C", "D", "E", "NR"];
const FLAG_LABEL: Record<string, { label: string; bad: boolean }> = {
  repeat_offender: { label: "Repeat offender", bad: true },
  diligence_conflict: { label: "Diligence conflict", bad: true },
  declined_credit: { label: "Declined risk", bad: false },
};

export default async function RatingsPage() {
  const rows = RISK_GRADES_ENABLED ? await getAllCuratorRatings() : [];
  const dist = GRADE_ORDER.map((g) => ({ g, n: rows.filter((r) => r.grade === g).length })).filter((d) => d.n > 0);

  return (
    <div className="max-w-[1000px]">
      <header className="mb-8">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-text-tertiary">
          Curator risk ratings
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold text-amber-400">Beta</span>
        </div>
        <div className="font-mono font-semibold text-[clamp(2.6rem,7vw,4.2rem)] leading-[0.98] tracking-[-0.03em] tabular-nums my-2">
          {rows.length}<span className="text-text-tertiary text-2xl"> rated</span>
        </div>
        <p className="font-mono text-sm text-text-secondary max-w-[640px] leading-relaxed">
          The annualized probability that a dollar entrusted to a curator suffers a loss,
          decomposed into the channels they control. Loss axis only — yield and fees are separate.
        </p>
        {dist.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {dist.map(({ g, n }) => (
              <span key={g} className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs ${gradeColor(g)}`}>
                <b className="font-semibold">{g}</b><span className="opacity-70">{n}</span>
              </span>
            ))}
          </div>
        )}
      </header>

      {rows.length > 0 && <BacktestPanel />}

      {rows.length === 0 ? (
        <p className="font-mono text-sm text-text-tertiary">No ratings available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-border">
                {["", "Curator", "Grade", "Expected loss / yr", "Confidence", "Signals"].map((h, i) => (
                  <th key={i} className={`font-mono text-[0.62rem] uppercase tracking-[0.1em] font-medium pb-3 px-3 text-text-tertiary ${i >= 3 ? "text-right max-sm:hidden" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const flags = Object.entries(r.flags).filter(([k, v]) => v && FLAG_LABEL[k]);
                return (
                  <tr key={r.curatorAddress} className="border-b border-border-subtle hover:bg-background-subtle transition-colors group">
                    <td className="py-3 px-3 font-mono text-xs text-text-tertiary tabular-nums">{i + 1}</td>
                    <td className="py-3 px-3">
                      <Link href={`/curator/${curatorSlug(r.name, r.curatorAddress)}`} title={GRADE_BLURB[r.grade]}
                        className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex min-w-[2rem] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-xs font-semibold ${gradeColor(r.grade)}`}>{r.grade}</span>
                    </td>
                    <td className="py-3 px-3 text-right max-sm:hidden font-mono text-sm tabular-nums text-text-secondary">{fmtBps(r.elMedian)}</td>
                    <td className="py-3 px-3 text-right max-sm:hidden font-mono text-xs text-text-tertiary">{r.confidence}</td>
                    <td className="py-3 px-3 text-right max-sm:hidden">
                      <div className="flex flex-wrap justify-end gap-1">
                        {flags.length === 0 ? <span className="font-mono text-xs text-text-tertiary">—</span> :
                          flags.map(([k]) => (
                            <span key={k} className={`rounded-full border px-1.5 py-px text-[10px] font-medium ${FLAG_LABEL[k].bad ? "border-accent-red/30 bg-accent-red/10 text-accent-red" : "border-accent-green/30 bg-accent-green/10 text-accent-green"}`}>
                              {FLAG_LABEL[k].label}
                            </span>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="font-mono text-xs text-text-tertiary mt-4 leading-relaxed">
            Sorted safest first by expected loss. Every band is currently Wide-confidence (early data);
            grades are durable and TVL-weighted across each curator&rsquo;s live book. Open a curator for the channel breakdown.
          </p>
        </div>
      )}
    </div>
  );
}

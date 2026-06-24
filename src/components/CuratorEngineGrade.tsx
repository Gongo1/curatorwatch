import { Sprout } from "lucide-react";
import type { CuratorEngineRating } from "@/lib/curator-engine-rating";
import { GRADE_BLURB } from "@/lib/grade-style";
import { hasCuratorDisclosure } from "@/lib/curator-disclosures";
import { DisclosureFlag } from "@/components/DisclosureFlag";

// Loss-anchored grade (A+…E) → colour. Lower expected loss = safer = greener.
const GRADE_STYLE: Record<string, string> = {
  "A+": "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  A: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "B+": "text-sky-400 border-sky-500/30 bg-sky-500/10",
  B: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  "C+": "text-amber-400 border-amber-500/30 bg-amber-500/10",
  C: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  D: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  E: "text-red-400 border-red-500/30 bg-red-500/10",
  NR: "text-text-tertiary border-border bg-background-subtle",
};

const CHANNEL_LABEL: Record<string, string> = {
  credit: "Credit",
  technical: "Technical",
  operational: "Operational",
};

const FLAG_LABEL: Record<string, { label: string; tone: "good" | "bad" }> = {
  repeat_offender: { label: "Repeat offender", tone: "bad" },
  diligence_conflict: { label: "Diligence conflict", tone: "bad" },
  declined_credit: { label: "Declined risk", tone: "good" },
};

const bps = (x: number) => `${(x * 1e4).toFixed(x < 0.001 ? 1 : 0)} bps`;

export function CuratorEngineGrade({ rating, curatorAddress }: { rating: CuratorEngineRating; curatorAddress?: string }) {
  const flagged = hasCuratorDisclosure(curatorAddress);
  const gradeStyle = GRADE_STYLE[rating.grade] ?? GRADE_STYLE.NR;
  const channels = Object.entries(rating.channels)
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => (b[1] as number) - (a[1] as number));
  const flags = Object.entries(rating.flags).filter(([k, v]) => v && FLAG_LABEL[k]);

  return (
    <div className="rounded-2xl border border-border bg-background-subtle p-5">
      <div className="flex items-start gap-5">
        {flagged ? (
          <DisclosureFlag size="lg" />
        ) : (
          <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border text-3xl font-bold font-display ${gradeStyle}`}>
            {rating.grade}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-sm font-bold text-text-primary">Expected-loss grade</h3>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
              Beta
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-text-tertiary">
              {rating.confidence} confidence
            </span>
            {rating.flags?.provisional ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-400">
                <Sprout className="h-3 w-3" /> Infant rating
              </span>
            ) : null}
          </div>
          {flagged ? (
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
              Letter grade withheld pending a material disclosure.{" "}
              <a href="#curator-disclosure" className="font-medium text-red-400 hover:underline">
                View disclosure ↓
              </a>
            </p>
          ) : rating.grade === "NR" ? (
            <p className="mt-1.5 text-xs text-text-secondary">
              Not rated — live book below the materiality threshold. Expected loss still shown below.
            </p>
          ) : (
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{GRADE_BLURB[rating.grade]}</p>
          )}
          {rating.flags?.provisional ? (
            <p className="mt-1.5 text-xs leading-relaxed text-orange-400/90">
              New curator — short on-chain track record. This grade leans on structure and peers
              more than realized history, so expect it to be volatile and move as the book seasons.
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <Metric label="Expected loss / yr" value={bps(rating.elMedian)}
              sub={`90% CI ${bps(rating.elCi[0])}–${bps(rating.elCi[1])}`} />
            <Metric label="P(loss) / yr"
              value={rating.pLossAnnual != null ? `${(rating.pLossAnnual * 100).toFixed(1)}%` : "—"} />
            <Metric label="Loss given loss"
              value={rating.lgdMedian != null ? `${(rating.lgdMedian * 100).toFixed(0)}%` : "—"} />
          </div>

          {channels.length ? (
            <div className="mt-3">
              <div className="text-[11px] font-medium text-text-tertiary">Loss channel breakdown</div>
              <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-background">
                {channels.map(([k, v]) => (
                  <div key={k} className="h-full" title={`${CHANNEL_LABEL[k] ?? k}: ${Math.round((v as number) * 100)}%`}
                    style={{ width: `${(v as number) * 100}%`,
                      background: k === "credit" ? "#38bdf8" : k === "technical" ? "#a78bfa" : "#fb923c" }} />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-secondary">
                {channels.map(([k, v]) => (
                  <span key={k}>{CHANNEL_LABEL[k] ?? k} {Math.round((v as number) * 100)}%</span>
                ))}
              </div>
            </div>
          ) : null}

          {flags.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {flags.map(([k]) => (
                <span key={k}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    FLAG_LABEL[k].tone === "bad"
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  }`}>
                  {FLAG_LABEL[k].label}
                </span>
              ))}
            </div>
          ) : null}

          <p className="mt-3 text-[10px] leading-relaxed text-text-tertiary">
            Loss axis only (yield/fees excluded). Curator-level Expected Loss, TVL-weighted across the live book.
            {" "}{rating.methodologyVersion}, schema {rating.schemaVersion}
            {rating.modelGit ? ` · model ${rating.modelGit}` : ""} · updated {rating.generatedAt.slice(0, 10)}.
          </p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-text-tertiary">{label}</div>
      <div className="font-display text-base font-bold text-text-primary tabular-nums">{value}</div>
      {sub ? <div className="text-[10px] text-text-tertiary tabular-nums">{sub}</div> : null}
    </div>
  );
}

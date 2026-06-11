import type { VaultEngineRating } from "@/lib/curator-engine-rating";
import { Tooltip } from "./Tooltip";

// Loss-anchored per-vault grade (A+…E) → colour. Position-specific number; the same
// model as the curator grade, evaluated at the vault level. A high-grade curator can
// still run one spicy vault — this surfaces that truth in the vault list.
const GRADE_STYLE: Record<string, string> = {
  "A+": "text-accent-green border-accent-green/30 bg-accent-green/10",
  A: "text-accent-green border-accent-green/30 bg-accent-green/10",
  "B+": "text-accent-blue border-accent-blue/30 bg-accent-blue/10",
  B: "text-accent-blue border-accent-blue/30 bg-accent-blue/10",
  "C+": "text-accent-yellow border-accent-yellow/30 bg-accent-yellow/10",
  C: "text-accent-yellow border-accent-yellow/30 bg-accent-yellow/10",
  D: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  E: "text-accent-red border-accent-red/30 bg-accent-red/10",
  NR: "text-text-tertiary border-border bg-background-subtle",
};

const bps = (x: number) => `${(x * 1e4).toFixed(x < 0.001 ? 1 : 0)} bps`;

export function VaultEngineGradeBadge({ rating }: { rating?: VaultEngineRating | null }) {
  if (!rating) return <span className="font-mono text-xs text-text-tertiary">—</span>;
  const style = GRADE_STYLE[rating.grade] ?? GRADE_STYLE.NR;
  const badge = (
    <span className={`inline-flex items-center justify-center min-w-[2rem] rounded border px-1.5 py-0.5 font-mono text-xs font-semibold ${style}`}>
      {rating.grade}
    </span>
  );
  return (
    <Tooltip
      position="bottom"
      content={
        <div className="space-y-0.5 text-left text-xs">
          <div>Expected loss: <span className="tabular-nums">{bps(rating.elMedian)}/yr</span></div>
          <div className="text-text-tertiary tabular-nums">90% CI {bps(rating.elCi[0])}–{bps(rating.elCi[1])}</div>
          {rating.pdAnnualMedian != null ? (
            <div className="text-text-tertiary">P(loss) {(rating.pdAnnualMedian * 100).toFixed(1)}% · LGD {rating.lgdMedian != null ? `${(rating.lgdMedian * 100).toFixed(0)}%` : "—"}</div>
          ) : null}
          <div className="pt-0.5 text-[10px] text-text-tertiary">Loss-axis only · same model as the curator grade</div>
        </div>
      }
    >
      {badge}
    </Tooltip>
  );
}

// Single source of truth for loss-anchored grade presentation (A+…E → colour),
// shared by the curator card, modal, ratings table, and per-vault badges.
export const GRADE_COLOR: Record<string, string> = {
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

export const gradeColor = (g: string) => GRADE_COLOR[g] ?? GRADE_COLOR.NR;

// Expected loss as basis points, concise.
export const fmtBps = (x: number) => `${(x * 1e4).toFixed(x < 0.001 ? 1 : 0)} bps`;

// One-line plain-language read of a grade (for blurbs/tooltips).
export const GRADE_BLURB: Record<string, string> = {
  "A+": "Fortress — losing money needs a systemic black swan",
  A: "Strong across credit, technical, and operational risk",
  "B+": "Solid, with one channel carrying bounded risk",
  B: "Reasonable, but a real recurring loss source is present",
  "C+": "Meaningful loss probability — yield-chasing or thin process",
  C: "Elevated — multiple weak channels or one acute",
  D: "High — expect impairment over a normal holding period",
  E: "Uninvestable on a loss basis",
  NR: "Not rated — book below the materiality threshold",
};

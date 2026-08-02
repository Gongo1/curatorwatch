/**
 * Curator Stress Index — the PSI analog ("VIX for curators").
 *
 * One named-band score (0–100) blending two transparent components:
 *  - concentration (structural fragility): the single-point-of-failure share of
 *    stablecoin TVL — how much sits behind each asset's single dominant manager.
 *  - flow (acute stress): the magnitude of recent net/ gross outflows vs TVL.
 *
 * Acute flow dominates the blend (a concentrated-but-calm market is fragile, not in
 * crisis); concentration is the slow-moving baseline. Components are exposed so the
 * score is auditable — the numbers make the claim, not a black box.
 */

import { stablecoinSpofPct, type CuratorLike } from "@/lib/concentration";

export type StressBand = "Calm" | "Normal" | "Elevated" | "Stressed" | "Critical";

export interface StressFlow {
  /** Net flow over the window as a fraction of TVL (negative = net outflow). */
  netFlowPct: number;
  /** Gross outflow over the window as a fraction of TVL (>= 0). */
  grossOutflowPct: number;
  windowDays: number;
}

export interface CuratorStressIndex {
  score: number; // 0–100
  band: StressBand;
  components: {
    concentration: number; // 0–100 structural
    flow: number | null; // 0–100 acute, null when flow data unavailable
  };
  drivers: string[];
  /** Single-point-of-failure share of stablecoin TVL (0–100). */
  spofPct: number;
}

const CONCENTRATION_WEIGHT = 0.35;
const FLOW_WEIGHT = 0.65;

const BANDS: { min: number; band: StressBand }[] = [
  { min: 80, band: "Critical" },
  { min: 60, band: "Stressed" },
  { min: 40, band: "Elevated" },
  { min: 20, band: "Normal" },
  { min: 0, band: "Calm" },
];

export function stressBand(score: number): StressBand {
  return BANDS.find((b) => score >= b.min)!.band;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function computeStressIndex(
  curators: CuratorLike[],
  flow?: StressFlow | null
): CuratorStressIndex {
  const spof = stablecoinSpofPct(curators);
  const concentration = clamp(spof);

  const drivers: string[] = [
    `${Math.round(spof)}% of stablecoin TVL sits behind a single dominant manager per asset`,
  ];

  let flowScore: number | null = null;
  if (flow) {
    const out = Math.max(0, -flow.netFlowPct); // net outflow fraction
    // "Rotation" = gross outflow BEYOND the net drain (money leaving while other money
    // arrives), so the same outflow dollars aren't charged once as net and again as gross.
    const rotation = Math.max(0, flow.grossOutflowPct - out);
    // Calibration: a 5% pure net outflow -> 60 (Stressed); +10% of churn on top -> +40.
    flowScore = clamp((out / 0.05) * 60 + (rotation / 0.1) * 40);
    drivers.push(
      out > 0
        ? `net ${(out * 100).toFixed(1)}% outflow over ${flow.windowDays}d`
        : `net inflow over ${flow.windowDays}d`
    );
  } else {
    drivers.push("flow component pending (no window data)");
  }

  const score = Math.round(
    CONCENTRATION_WEIGHT * concentration + FLOW_WEIGHT * (flowScore ?? 0)
  );

  return {
    score,
    band: stressBand(score),
    components: {
      concentration: Math.round(concentration),
      flow: flowScore === null ? null : Math.round(flowScore),
    },
    drivers,
    spofPct: spof,
  };
}

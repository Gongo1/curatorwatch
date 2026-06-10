/**
 * Server-side read of the loss-anchored Expected-Loss curator rating (from the
 * external risk engine, imported into CuratorRating by
 * scripts/import-risk-engine-ratings.ts). Read from precomputed DB — no client fetch.
 *
 * Coexists with the live 7-factor peer-percentile profile (curator-risk-profile.ts):
 * this is the durable headline grade; the percentile profile is the supporting detail.
 * Feature-flagged via NEXT_PUBLIC_FEATURE_RISK_GRADES.
 */
import { cache } from "react";
import { prisma } from "@/lib/db";

export const RISK_GRADES_ENABLED = process.env.NEXT_PUBLIC_FEATURE_RISK_GRADES === "true";

export interface CuratorEngineRating {
  grade: string; // A+ | A | B+ | B | C+ | C | D | E | NR
  elMedian: number;
  elCi: [number, number];
  pLossAnnual: number | null;
  lgdMedian: number | null;
  channels: { credit?: number; technical?: number; operational?: number };
  confidence: string; // Tight | Moderate | Wide
  flags: Record<string, boolean>;
  nVaults: number | null;
  tvlUsd: number | null;
  exposureMonths: number | null;
  events: number | null;
  methodologyVersion: string;
  schemaVersion: string;
  modelGit: string | null;
  generatedAt: string;
}

export const getCuratorEngineRating = cache(
  async (curatorAddress: string): Promise<CuratorEngineRating | null> => {
    if (!RISK_GRADES_ENABLED) return null;
    const row = await prisma.curatorRating.findUnique({
      where: { curatorAddress: curatorAddress.toLowerCase() },
    });
    if (!row) return null;
    return {
      grade: row.grade,
      elMedian: row.elMedian,
      elCi: [row.elCiLow, row.elCiHigh],
      pLossAnnual: row.pLossAnnual,
      lgdMedian: row.lgdMedian,
      channels: (row.channels as CuratorEngineRating["channels"]) ?? {},
      confidence: row.confidence,
      flags: (row.flags as Record<string, boolean>) ?? {},
      nVaults: row.nVaults,
      tvlUsd: row.tvlUsd,
      exposureMonths: row.exposureMonths,
      events: row.events,
      methodologyVersion: row.methodologyVersion,
      schemaVersion: row.schemaVersion,
      modelGit: row.modelGit,
      generatedAt: row.generatedAt.toISOString(),
    };
  },
);

"use client";

import { useState, useEffect } from "react";
import type { CuratorRiskProfile as CuratorRiskProfileType, RiskFactor } from "@/lib/curator-risk-profile";

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

interface CuratorRiskProfileProps {
  curatorAddress: string;
  /** ISO timestamp the page's underlying data was last collected. */
  dataAsOf?: string | null;
}

export function CuratorRiskProfile({ curatorAddress, dataAsOf }: CuratorRiskProfileProps) {
  const [profile, setProfile] = useState<CuratorRiskProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);
        const response = await fetch(`/api/curators/${curatorAddress}/rating`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch risk profile");
        }

        setProfile(data.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load risk profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [curatorAddress]);

  if (loading) return <ProfileSkeleton />;

  if (error || !profile) {
    return (
      <div className="bg-background-subtle rounded-lg border border-border p-8 text-center">
        <p className="text-sm text-text-tertiary">{error || "Unable to load risk profile."}</p>
      </div>
    );
  }

  if (profile.factors.length === 0) {
    return (
      <div className="bg-background-subtle rounded-lg border border-border p-8 text-center">
        <p className="text-sm text-text-tertiary">No risk profile data available for this curator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dense factor table — one row per peer-ranked factor */}
      <div className="border border-border rounded-xl bg-background-subtle divide-y divide-border-subtle overflow-hidden">
        {profile.factors.map((factor) => (
          <FactorRow key={factor.id} factor={factor} />
        ))}
      </div>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="font-mono text-xs text-text-tertiary max-w-[560px]">
          Bars rank this curator against {profile.peerCount} tracked curators — relative,
          not absolute. Green = better than most peers, red = worse.
        </p>
        {dataAsOf && (
          <span className="font-mono text-[0.62rem] text-text-tertiary whitespace-nowrap">
            ratings computed from data as of {fmtAsOf(dataAsOf)}
          </span>
        )}
      </div>

      {/* Live incident record (sourced) — only renders when events exist */}
      <IncidentRecord factors={profile.factors} />
    </div>
  );
}

// Absolute UTC stamp, e.g. "Jun 11, 12:04 UTC".
function fmtAsOf(iso: string): string {
  return (
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }) + " UTC"
  );
}

// ============================================================================
// LIVE INCIDENT RECORD (sourced)
// ============================================================================

function IncidentRecord({ factors }: { factors: RiskFactor[] }) {
  const badDebt = factors.find((f) => f.id === "bad-debt");
  const incidents = badDebt && "incidents" in badDebt ? badDebt.incidents : [];

  // Clean curator: the Bad-Debt factor row already reads "None on record" —
  // no separate card needed, and nothing is asserted that we can't source.
  if (incidents.length === 0) return null;

  return (
    <div className="border border-border rounded-xl bg-background-subtle overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border-subtle flex items-center justify-between gap-3">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary">
          Loss &amp; incident record · sourced
        </span>
        <span className="font-mono text-[0.62rem] text-text-tertiary">
          {incidents.length} on record
        </span>
      </div>
      <ul className="divide-y divide-border-subtle">
        {incidents.map((inc, i) => (
          <li key={i} className="px-4 py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-text-primary">{inc.event}</div>
              {inc.note && (
                <div className="font-mono text-[0.65rem] text-text-tertiary mt-0.5 leading-snug">
                  {inc.note}
                </div>
              )}
            </div>
            <div className="flex-none text-right">
              <div className="font-mono text-sm tabular-nums text-accent-red">
                {inc.exposureUsd != null ? compactUsd(inc.exposureUsd) : "—"}
              </div>
              <a
                href={inc.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[0.62rem] text-accent-blue hover:underline"
              >
                {inc.date} ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
      <p className="px-4 py-2.5 border-t border-border-subtle font-mono text-[0.6rem] text-text-tertiary leading-relaxed">
        Figures are third-party exposure estimates (at-risk amounts), not confirmed
        realized losses. Each entry is dated and linked to its source.
      </p>
    </div>
  );
}

// ============================================================================
// FACTOR CARD
// ============================================================================

const TIER_TEXT_COLOR: Record<string, string> = {
  top: "text-accent-green",
  "above-avg": "text-accent-green",
  average: "text-accent-yellow",
  "below-avg": "text-accent-red",
  bottom: "text-accent-red",
};

const TIER_BAR_COLOR: Record<string, string> = {
  top: "bg-accent-green",
  "above-avg": "bg-accent-green",
  average: "bg-accent-yellow",
  "below-avg": "bg-accent-red",
  bottom: "bg-accent-red",
};

const TIER_LABEL: Record<string, string> = {
  top: "Top tier",
  "above-avg": "Above avg",
  average: "Average",
  "below-avg": "Below avg",
  bottom: "Bottom tier",
};

function FactorRow({ factor }: { factor: RiskFactor }) {
  const { primary, secondary } = getFactorDisplay(factor);
  const tier = factor.peer.tier;
  const isBadDebtIncident =
    factor.id === "bad-debt" && factor.incidents.length > 0;

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-background-hover/40 transition-colors">
      <span className={`w-1.5 h-1.5 rounded-sm flex-none ${TIER_BAR_COLOR[tier]}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate">
          <span className="font-medium text-text-primary">{factor.label}</span>
          <span className="text-text-secondary"> · {primary}</span>
        </div>
        <div className="font-mono text-[0.65rem] text-text-tertiary truncate">
          {secondary}
          {isBadDebtIncident && (
            <>
              {" — est. exposure, not realized. "}
              <a
                href={factor.incidents[0].sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-blue hover:underline"
              >
                {factor.incidents[0].date} ↗
              </a>
            </>
          )}
        </div>
      </div>
      <div className="w-[116px] flex-none">
        <div className="h-1 bg-background-elevated rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${TIER_BAR_COLOR[tier]}`}
            style={{ width: `${factor.peer.percentile}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 font-mono text-[0.58rem] tabular-nums">
          <span className={TIER_TEXT_COLOR[tier]}>{TIER_LABEL[tier]}</span>
          <span className="text-text-tertiary">{ordinal(factor.peer.percentile)}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FACTOR-SPECIFIC DISPLAY
// ============================================================================

function getFactorDisplay(factor: RiskFactor): { primary: string; secondary: string } {
  switch (factor.id) {
    case "bad-debt": {
      if (factor.hasEvents) {
        const formatted = factor.totalExposure >= 1_000_000
          ? `$${(factor.totalExposure / 1e6).toFixed(1)}M`
          : `$${(factor.totalExposure / 1e3).toFixed(0)}K`;
        return {
          primary: `${formatted} exposure`,
          secondary: factor.incidents[0]?.event ?? factor.eventDescription ?? "Incident on record",
        };
      }
      return { primary: "None on record", secondary: "No documented loss events" };
    }

    case "time-in-operation": {
      const primary = factor.foundedYear ? `Founded ${factor.foundedYear}` : "Unknown";
      const secondary = factor.monthsActive > 0
        ? `${factor.monthsActive} months operating`
        : "Operating duration unknown";
      return { primary, secondary };
    }

    case "collateral-quality": {
      if (!factor.hasData) {
        return { primary: "No data", secondary: "Insufficient collateral data" };
      }
      const bcPct = Math.round(factor.blueChipPct);
      if (bcPct >= 100) {
        return {
          primary: "100% blue-chip",
          secondary: factor.collateralList.slice(0, 6).join(", "),
        };
      }
      return {
        primary: `${bcPct}% blue-chip`,
        secondary: factor.collateralList.slice(0, 6).join(", "),
      };
    }

    case "governance-legal": {
      const primary = factor.legalName ?? "No registered entity";
      const parts: string[] = [];
      if (factor.entityType) parts.push(factor.entityType);
      if (factor.jurisdiction) parts.push(factor.jurisdiction);
      if (factor.isRegulated) parts.push(`Regulated${factor.regulatoryBody ? ` (${factor.regulatoryBody})` : ""}`);
      return { primary, secondary: parts.join(" · ") || "No governance data" };
    }

    case "scale": {
      const aum = factor.aumUsd;
      let primary: string;
      if (aum >= 1_000_000_000) primary = `$${(aum / 1e9).toFixed(2)}B AUM`;
      else if (aum >= 1_000_000) primary = `$${(aum / 1e6).toFixed(0)}M AUM`;
      else if (aum >= 1_000) primary = `$${(aum / 1e3).toFixed(0)}K AUM`;
      else primary = `$${aum.toFixed(0)} AUM`;

      let secondary: string;
      if (aum >= 500_000_000) secondary = "Mega scale";
      else if (aum >= 100_000_000) secondary = "Institutional scale";
      else if (aum >= 50_000_000) secondary = "Growth stage";
      else if (aum >= 10_000_000) secondary = "Emerging scale";
      else secondary = "Early stage";

      return { primary, secondary };
    }

    case "vault-count": {
      const primary = `${factor.count} vault${factor.count !== 1 ? "s" : ""}`;
      const secondary = factor.protocols.length > 0
        ? factor.protocols.join(", ")
        : "Morpho";
      return { primary, secondary };
    }

    case "team-transparency": {
      const primary = factor.teamSize ?? "Unknown";
      const checks: string[] = [];
      if (factor.hasWebsite) checks.push("Website \u2713");
      if (factor.hasTwitter) checks.push("Twitter \u2713");
      if (factor.hasDiscord) checks.push("Discord \u2713");
      if (factor.hasDescription) checks.push("Bio \u2713");
      return {
        primary: factor.teamSize ? `${factor.teamSize} employees` : "Team size unknown",
        secondary: checks.length > 0 ? checks.join("  ") : "No public presence",
      };
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ============================================================================
// SKELETON
// ============================================================================

function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-14 bg-background-elevated rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="bg-background-subtle rounded-lg border border-border p-5">
            <div className="flex justify-between mb-3">
              <div className="h-4 w-32 bg-background-elevated rounded" />
              <div className="h-4 w-16 bg-background-elevated rounded" />
            </div>
            <div className="h-6 w-24 bg-background-elevated rounded mb-1" />
            <div className="h-3 w-40 bg-background-elevated/50 rounded mb-3" />
            <div className="h-1.5 w-full bg-background-elevated rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

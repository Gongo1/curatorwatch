"use client";

import { useState, useEffect } from "react";
import type { CuratorRiskProfile as CuratorRiskProfileType, RiskFactor } from "@/lib/curator-risk-profile";

// USR exposure data by curator address (lowercase)
interface UsrExposure {
  vaultsAffected: number;
  totalVaults: number;
  exposureUsd: number;
  percentile: number;
  tier: "bottom" | "below-avg";
}

const USR_CURATOR_EXPOSURE: Record<string, UsrExposure> = {
  // Gauntlet
  "0x9e33faae38ff641094fa68c65c2ce600b3410585": { vaultsAffected: 2, totalVaults: 12, exposureUsd: 5_000_000, percentile: 10, tier: "bottom" },
  // Re7 Labs
  "0x72882eb5d27c7088dfa6dde941dd42e5d184f0ef": { vaultsAffected: 1, totalVaults: 8, exposureUsd: 450_000, percentile: 20, tier: "below-avg" },
  // KPK
  "0xc266b1181a80e84edc2c6596718e88e8115c1eaa": { vaultsAffected: 1, totalVaults: 6, exposureUsd: 221_000, percentile: 30, tier: "below-avg" },
  // MEV Capital
  "0x38989bba00bdf8181f4082995b3deae96163ac5d": { vaultsAffected: 1, totalVaults: 14, exposureUsd: 52_000, percentile: 35, tier: "below-avg" },
  // Keyrock
  "0xba75546acd56b3a9142f94f179b03970ee4283fd": { vaultsAffected: 1, totalVaults: 2, exposureUsd: 36_000, percentile: 40, tier: "below-avg" },
};

function getUsrExposure(curatorAddress: string): UsrExposure | null {
  return USR_CURATOR_EXPOSURE[curatorAddress.toLowerCase()] ?? null;
}

interface CuratorRiskProfileProps {
  curatorAddress: string;
}

export function CuratorRiskProfile({ curatorAddress }: CuratorRiskProfileProps) {
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

  const usrExposure = getUsrExposure(curatorAddress);

  // Get founded year from the time-in-operation factor if available
  const timeInOpFactor = profile.factors.find((f) => f.id === "time-in-operation");
  const foundedYear = timeInOpFactor && "foundedYear" in timeInOpFactor ? timeInOpFactor.foundedYear : null;

  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <div className="rounded-lg border border-accent-yellow/30 bg-accent-yellow/5 px-5 py-4">
        <p className="text-sm text-text-secondary">
          Colors show how this curator compares to{" "}
          <span className="font-semibold text-text-primary">{profile.peerCount}</span> tracked
          curators. Green = better than most peers, red = worse. This is relative, not absolute.
        </p>
      </div>

      {/* Factor Cards — first 2 always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profile.factors.slice(0, 2).map((factor) => (
          <FactorCard key={factor.id} factor={factor} />
        ))}
      </div>

      {/* Remaining cards */}
      {profile.factors.length > 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.factors.slice(2).map((factor) => (
            <FactorCard key={factor.id} factor={factor} />
          ))}
        </div>
      )}

      {/* Risk Management Track Record */}
      <RiskTrackRecord
          usrExposure={usrExposure}
          foundedYear={foundedYear}
          peerCount={profile.peerCount}
        />
    </div>
  );
}

// ============================================================================
// RISK MANAGEMENT TRACK RECORD
// ============================================================================

function RiskTrackRecord({
  usrExposure,
  foundedYear,
  peerCount,
}: {
  usrExposure: UsrExposure | null;
  foundedYear: number | null;
  peerCount: number;
}) {
  if (usrExposure) {
    const exposureStr = usrExposure.exposureUsd >= 1_000_000
      ? `$${(usrExposure.exposureUsd / 1e6).toFixed(1)}M`
      : `$${(usrExposure.exposureUsd / 1e3).toFixed(0)}K`;
    const affectedPct = Math.round((usrExposure.vaultsAffected / usrExposure.totalVaults) * 100);
    const tierLabel = usrExposure.tier === "bottom" ? "Bottom tier" : "Below avg";
    const tierTextColor = usrExposure.tier === "bottom" ? "text-accent-red" : "text-orange-400";
    const tierBorderColor = usrExposure.tier === "bottom" ? "border-l-accent-red" : "border-l-orange-400";
    const tierBarColor = usrExposure.tier === "bottom" ? "bg-accent-red" : "bg-orange-400";
    const tierBadgeBg = usrExposure.tier === "bottom" ? "bg-accent-red/15 border-accent-red/30" : "bg-orange-400/15 border-orange-400/30";

    return (
      <div className={`bg-background-subtle rounded-lg border border-border border-l-4 ${tierBorderColor} p-5`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${tierBarColor}`} />
            <span className="text-sm font-semibold text-text-primary">Risk Management Track Record</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${tierBadgeBg} ${tierTextColor}`}>
            {tierLabel}
          </span>
        </div>

        {/* Recent Events */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Recent Events</p>
          <div className="bg-background-elevated/50 rounded-lg p-3 border border-border-subtle">
            <p className="text-sm font-medium text-accent-red mb-1.5">
              &#x26A0;&#xFE0F; Resolv USR Exposure (Mar 2026)
            </p>
            <ul className="space-y-1 text-sm text-text-secondary">
              <li>Allocated {exposureStr} to unstable markets</li>
              <li>{usrExposure.vaultsAffected} of {usrExposure.totalVaults} vaults affected ({affectedPct}%)</li>
              <li>Response time: 48+ hours</li>
            </ul>
          </div>
        </div>

        {/* Historical Performance */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Historical Performance</p>
          <ul className="space-y-1 text-sm">
            <li className="text-accent-green">&#x2713; Zero bad debt (2018&ndash;2025)</li>
            <li className="text-accent-green">&#x2713; Clean liquidation history</li>
            <li className="text-accent-red">&#x2717; USR incident (2026)</li>
          </ul>
        </div>

        {/* Percentile bar */}
        <div>
          <div className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${tierBarColor}`}
              style={{ width: `${usrExposure.percentile}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-text-muted">
              {ordinal(usrExposure.percentile)} percentile
            </span>
            <span className="text-[10px] text-text-muted">
              among {peerCount} curators
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Clean curator — no USR exposure
  return (
    <div className="bg-background-subtle rounded-lg border border-border border-l-4 border-l-accent-green p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent-green" />
          <span className="text-sm font-semibold text-text-primary">Risk Management Track Record</span>
        </div>
        <span className="px-2 py-0.5 rounded text-xs font-medium border bg-accent-green/15 border-accent-green/30 text-accent-green">
          Top tier
        </span>
      </div>

      {/* Clean record */}
      <div className="mb-4">
        <p className="text-sm text-text-secondary mb-2">No recent risk events</p>
        <ul className="space-y-1 text-sm">
          <li className="text-accent-green">&#x2713; Zero bad debt history</li>
          <li className="text-accent-green">&#x2713; No exposure to failed markets</li>
          <li className="text-accent-green">
            &#x2713; Consistent risk management{foundedYear ? ` since ${foundedYear}` : ""}
          </li>
        </ul>
      </div>

      {/* Percentile bar */}
      <div>
        <div className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-accent-green" style={{ width: "100%" }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-text-muted">100th percentile</span>
          <span className="text-[10px] text-text-muted">among {peerCount} curators</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FACTOR CARD
// ============================================================================

const TIER_BORDER_COLOR: Record<string, string> = {
  top: "border-l-accent-green",
  "above-avg": "border-l-accent-green",
  average: "border-l-accent-yellow",
  "below-avg": "border-l-accent-red",
  bottom: "border-l-accent-red",
};

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

function FactorCard({ factor }: { factor: RiskFactor }) {
  const { primary, secondary } = getFactorDisplay(factor);
  const tier = factor.peer.tier;

  return (
    <div
      className={`bg-background-subtle rounded-lg border border-border border-l-4 ${TIER_BORDER_COLOR[tier]} p-5`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${TIER_BAR_COLOR[tier]}`} />
          <span className="text-sm font-semibold text-text-primary">{factor.label}</span>
        </div>
        <span className={`text-xs font-medium ${TIER_TEXT_COLOR[tier]}`}>
          {TIER_LABEL[tier]}
        </span>
      </div>

      {/* Values */}
      <div className="mb-3">
        <div className="text-lg font-semibold text-text-primary">{primary}</div>
        <div className="text-xs text-text-tertiary mt-0.5">{secondary}</div>
        {factor.id === "bad-debt" && factor.incidents.length > 0 && (
          <div className="text-[10px] text-text-muted mt-1 leading-snug">
            Estimated exposure, not a confirmed realized loss.{" "}
            <a
              href={factor.incidents[0].sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-blue hover:underline"
            >
              {factor.incidents[0].date} · source ↗
            </a>
          </div>
        )}
      </div>

      {/* Percentile bar */}
      <div>
        <div className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${TIER_BAR_COLOR[tier]}`}
            style={{ width: `${factor.peer.percentile}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-text-muted">
            {ordinal(factor.peer.percentile)} percentile
          </span>
          <span className="text-[10px] text-text-muted">
            among {factor.peer.peerCount} curators
          </span>
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

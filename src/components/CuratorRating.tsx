"use client";

import { useState, useEffect } from "react";
import type { CuratorRiskRating, CuratorTier, RedFlag, GreenFlag } from "@/lib/curator-rating";
import { getTierColor, getTierDescription } from "@/lib/curator-rating";

interface CuratorRatingProps {
  curatorAddress: string;
  rating?: CuratorRiskRating;
  compact?: boolean;
}

export function CuratorRating({ curatorAddress, rating: initialRating, compact = false }: CuratorRatingProps) {
  const [rating, setRating] = useState<CuratorRiskRating | null>(initialRating || null);
  const [loading, setLoading] = useState(!initialRating);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialRating && curatorAddress) {
      fetchRating();
    }
  }, [curatorAddress, initialRating]);

  async function fetchRating() {
    try {
      setLoading(true);
      const response = await fetch(`/api/curators/${curatorAddress}/rating`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch rating");
      }

      setRating(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rating");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return compact ? <CompactRatingSkeleton /> : <FullRatingSkeleton />;
  }

  if (error || !rating) {
    if (compact) {
      return <span className="text-[10px] text-text-muted">-</span>;
    }
    return (
      <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg p-4 text-center text-sm">
        <p className="text-accent-red">{error || "Rating not available"}</p>
      </div>
    );
  }

  if (compact) {
    return <CompactRating rating={rating} />;
  }

  return <FullRating rating={rating} />;
}

// Compact badge - minimal subscript
function CompactRating({ rating }: { rating: CuratorRiskRating }) {
  const tierColor = getTierColor(rating.tier);

  return (
    <span
      className="text-[10px] font-semibold"
      style={{ color: tierColor }}
    >
      {rating.tier}
    </span>
  );
}

// Full rating display
function FullRating({ rating }: { rating: CuratorRiskRating }) {
  const tierColor = getTierColor(rating.tier);
  const tierDescription = getTierDescription(rating.tier);

  return (
    <div className="space-y-6">
      {/* Rating Header */}
      <div
        className="rounded-xl border-2 p-6"
        style={{
          background: `linear-gradient(135deg, ${tierColor}10 0%, ${tierColor}05 100%)`,
          borderColor: `${tierColor}40`
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="flex items-baseline gap-4">
            <span
              className="text-6xl font-bold"
              style={{ color: tierColor }}
            >
              {rating.tier}
            </span>
            <div>
              <div className="text-2xl font-semibold text-text-primary">
                {rating.score}/100
              </div>
              <div className="text-sm text-text-tertiary">
                Top {100 - rating.percentileRank}% of curators
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-sm text-text-tertiary">Tier Classification</div>
            <div
              className="text-lg font-semibold"
              style={{ color: tierColor }}
            >
              {tierDescription}
            </div>
          </div>
        </div>

        <p className="text-sm text-text-tertiary">
          {rating.methodology}
        </p>
      </div>

      {/* Red Flags */}
      {rating.redFlags.length > 0 && (
        <div className="bg-accent-red/5 border border-accent-red/20 rounded-lg p-5">
          <h4 className="font-semibold text-accent-red mb-4 flex items-center gap-2">
            <AlertTriangleIcon className="w-5 h-5" />
            Risk Flags ({rating.redFlags.length})
          </h4>
          <ul className="space-y-3">
            {rating.redFlags.map((flag, i) => (
              <RedFlagItem key={i} flag={flag} />
            ))}
          </ul>
        </div>
      )}

      {/* Green Flags */}
      {rating.greenFlags.length > 0 && (
        <div className="bg-accent-green/5 border border-accent-green/20 rounded-lg p-5">
          <h4 className="font-semibold text-accent-green mb-4 flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5" />
            Strengths ({rating.greenFlags.length})
          </h4>
          <ul className="space-y-3">
            {rating.greenFlags.map((flag, i) => (
              <GreenFlagItem key={i} flag={flag} />
            ))}
          </ul>
        </div>
      )}

      {/* Stream Finance Lesson */}
      <div className="p-4 bg-accent-yellow/5 rounded-lg border-l-4 border-accent-yellow">
        <div className="text-sm text-text-secondary">
          <strong className="text-accent-yellow">Lesson from Stream Finance Collapse (Nov 2025):</strong>{" "}
          $285M in bad debt spread across curators who accepted synthetic xUSD without proper due diligence.
          Steakhouse Financial survived with zero exposure due to conservative collateral standards.
          This rating system encodes those failure patterns.
        </div>
      </div>
    </div>
  );
}

function RedFlagItem({ flag }: { flag: RedFlag }) {
  const severityColors = {
    critical: "text-accent-red",
    high: "text-orange-400",
    medium: "text-accent-yellow",
    low: "text-text-secondary"
  };

  const severityIcons = {
    critical: "🚨",
    high: "⚠️",
    medium: "⚠️",
    low: "ℹ️"
  };

  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="mt-0.5">{severityIcons[flag.severity]}</span>
      <div>
        <div className={`font-medium ${severityColors[flag.severity]}`}>
          {flag.type.replace(/_/g, " ")}
        </div>
        <div className="text-text-tertiary">{flag.description}</div>
      </div>
    </li>
  );
}

function GreenFlagItem({ flag }: { flag: GreenFlag }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <CheckCircleIcon className="w-4 h-4 text-accent-green mt-0.5 flex-shrink-0" />
      <div>
        <div className="font-medium text-text-primary">
          {flag.type.replace(/_/g, " ")}
        </div>
        <div className="text-text-tertiary">{flag.description}</div>
      </div>
    </li>
  );
}

// Skeletons
function CompactRatingSkeleton() {
  return (
    <span className="text-[10px] text-text-muted animate-pulse">---</span>
  );
}

function FullRatingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-background-subtle rounded-xl border border-border p-6">
        <div className="flex items-baseline gap-4 mb-4">
          <div className="h-16 w-24 bg-background-elevated rounded" />
          <div>
            <div className="h-8 w-20 bg-background-elevated rounded mb-2" />
            <div className="h-4 w-32 bg-background-elevated/50 rounded" />
          </div>
        </div>
        <div className="h-4 w-full bg-background-elevated/50 rounded" />
      </div>

      <div className="bg-background-subtle rounded-lg border border-border p-5">
        <div className="h-5 w-32 bg-background-elevated rounded mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 bg-background-elevated/50 rounded" />
              <div className="h-5 w-24 bg-background-elevated rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Icons
function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

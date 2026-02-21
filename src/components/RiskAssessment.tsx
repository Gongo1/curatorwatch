"use client";

import { useState } from "react";
import {
  type RiskAssessment,
  type RiskCategory,
  type RiskLevel,
  getRiskLevelColors,
  getCategoryDisplayName,
} from "@/lib/institutional-risk-assessment";

interface RiskAssessmentCardProps {
  assessment: RiskAssessment;
  compact?: boolean;
}

export function RiskAssessmentCard({ assessment, compact = false }: RiskAssessmentCardProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const overallColors = getRiskLevelColors(assessment.overallRisk);

  if (compact) {
    return <CompactRiskBadge assessment={assessment} />;
  }

  return (
    <div className="space-y-4">
      {/* Overall Risk Summary */}
      <div className={`p-5 rounded-xl border ${overallColors.bg} ${overallColors.border}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Institutional Risk Assessment
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Based on 5 risk categories • Updated {formatTimeAgo(assessment.lastUpdated)}
            </p>
          </div>
          <div className={`px-3 py-1.5 rounded-lg border font-semibold text-sm ${overallColors.badge}`}>
            {assessment.overallRisk}
          </div>
        </div>

        {/* Score Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-text-tertiary">Risk Score</span>
            <span className={`font-medium ${overallColors.text}`}>
              {assessment.overallScore}/100
            </span>
          </div>
          <div className="h-2 bg-background-elevated rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getScoreBarColor(assessment.overallScore)}`}
              style={{ width: `${assessment.overallScore}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-text-muted mt-1">
            <span>High Risk</span>
            <span>Low Risk</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 gap-3">
        {(Object.entries(assessment.categories) as [keyof typeof assessment.categories, RiskCategory][]).map(
          ([key, category]) => (
            <RiskCategoryCard
              key={key}
              categoryKey={key}
              category={category}
              expanded={expandedCategory === key}
              onToggle={() => setExpandedCategory(expandedCategory === key ? null : key)}
            />
          )
        )}
      </div>

      {/* Methodology Note */}
      <div className="p-3 rounded-lg bg-background-elevated border border-border-subtle">
        <p className="text-xs text-text-tertiary leading-relaxed">
          <span className="font-medium text-text-secondary">Methodology:</span> Risk assessment based on
          institutional due diligence frameworks and historical DeFi failure modes (Rari, Cream, Inverse, Celsius).
          Categories weighted: Smart Contract 25%, Oracle 20%, Collateral 20%, Operational 20%, LLTV 15%.
        </p>
      </div>
    </div>
  );
}

interface RiskCategoryCardProps {
  categoryKey: string;
  category: RiskCategory;
  expanded: boolean;
  onToggle: () => void;
}

function RiskCategoryCard({ categoryKey, category, expanded, onToggle }: RiskCategoryCardProps) {
  const colors = getRiskLevelColors(category.level);
  const displayName = getCategoryDisplayName(categoryKey as keyof RiskAssessment["categories"]);
  const Icon = getCategoryIconComponent(categoryKey);

  return (
    <div className={`rounded-lg border ${colors.border} overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full p-3 flex items-center gap-3 hover:bg-background-hover transition-colors ${colors.bg}`}
      >
        <div className={`p-2 rounded-lg ${colors.bg}`}>
          <Icon className={`w-4 h-4 ${colors.text}`} />
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{displayName}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded border ${colors.badge}`}>
              {category.level.replace(" Risk", "")}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1 bg-background-elevated rounded-full overflow-hidden">
              <div
                className={`h-full ${getScoreBarColor(category.score)}`}
                style={{ width: `${category.score}%` }}
              />
            </div>
            <span className="text-xs text-text-tertiary w-8">{category.score}</span>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-text-tertiary transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border-subtle bg-background-subtle">
          {/* Factors */}
          <div className="space-y-1.5">
            {category.factors.map((factor, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {factor.startsWith("⚠") ? (
                  <span className="text-accent-yellow mt-0.5">!</span>
                ) : (
                  <span className="text-text-muted mt-0.5">•</span>
                )}
                <span className={factor.startsWith("⚠") ? "text-text-secondary" : "text-text-secondary"}>
                  {factor.replace("⚠ ", "")}
                </span>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {category.recommendations && category.recommendations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
                Recommendations
              </p>
              <div className="space-y-1.5">
                {category.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-accent-blue mt-0.5">→</span>
                    <span className="text-text-secondary">{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact badge for use in tables/lists
 */
export function CompactRiskBadge({ assessment }: { assessment: RiskAssessment }) {
  const colors = getRiskLevelColors(assessment.overallRisk);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${colors.badge}`}>
      <div className={`w-2 h-2 rounded-full ${colors.text.replace("text-", "bg-")}`} />
      <span className="text-xs font-medium">{assessment.overallRisk.replace(" Risk", "")}</span>
      <span className="text-xs opacity-70">({assessment.overallScore})</span>
    </div>
  );
}

/**
 * Mini risk indicator for compact displays
 */
export function RiskIndicator({ level, score }: { level: RiskLevel; score: number }) {
  const colors = getRiskLevelColors(level);

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${colors.text.replace("text-", "bg-")}`} />
      <span className={`text-xs font-medium ${colors.text}`}>
        {level.replace(" Risk", "")}
      </span>
    </div>
  );
}

// Helper functions
function getScoreBarColor(score: number): string {
  if (score >= 70) return "bg-accent-green";
  if (score >= 40) return "bg-accent-yellow";
  return "bg-accent-red";
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Icon components
function getCategoryIconComponent(category: string) {
  const icons: Record<string, React.FC<{ className?: string }>> = {
    smartContract: ShieldIcon,
    oracle: ActivityIcon,
    collateral: CoinsIcon,
    lltv: TrendingUpIcon,
    operational: UsersIcon,
  };
  return icons[category] || AlertCircleIcon;
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function CoinsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function TrendingUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

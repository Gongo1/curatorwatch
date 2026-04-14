import { Tooltip } from "./Tooltip";
import type { VaultWarning } from "@/lib/types/api";

const WARNING_LABELS: Record<string, string> = {
  not_whitelisted: "Not whitelisted by Morpho governance",
  timelock: "No timelock protection",
  unrecognized_oracle: "Uses an unrecognized oracle",
  unrecognized_collateral: "Uses unrecognized collateral",
  incorrect_loan_exchange_rate: "Incorrect loan exchange rate",
  hardcoded_oracle: "Uses a hardcoded oracle",
};

function getWarningLabel(type: string): string {
  return WARNING_LABELS[type] || type.replace(/_/g, " ");
}

function getMaxLevel(warnings: VaultWarning[]): "RED" | "YELLOW" | null {
  let maxLevel: "RED" | "YELLOW" | null = null;
  for (const w of warnings) {
    const level = w.level?.toUpperCase();
    if (level === "RED") return "RED";
    if (level === "YELLOW") maxLevel = "YELLOW";
  }
  return maxLevel;
}

export function VaultWarningBadge({ warnings }: { warnings?: VaultWarning[] }) {
  if (!warnings || warnings.length === 0) return null;

  // Filter out GREEN-level warnings
  const significantWarnings = warnings.filter(
    (w) => w.level?.toUpperCase() !== "GREEN"
  );
  if (significantWarnings.length === 0) return null;

  const maxLevel = getMaxLevel(significantWarnings);

  const colorClasses =
    maxLevel === "RED"
      ? "text-accent-red bg-accent-red/10 border-accent-red/20"
      : "text-accent-yellow bg-accent-yellow/10 border-accent-yellow/20";

  const badge = (
    <span
      className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded border ${colorClasses}`}
    >
      <svg
        className="w-2.5 h-2.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    </span>
  );

  return (
    <Tooltip
      content={
        <ul className="space-y-0.5 text-left">
          {significantWarnings.map((w, i) => (
            <li key={i}>
              <span
                className={
                  w.level?.toUpperCase() === "RED"
                    ? "text-accent-red"
                    : "text-accent-yellow"
                }
              >
                {w.level?.toUpperCase() === "RED" ? "!!!" : "!"}
              </span>{" "}
              {getWarningLabel(w.type)}
            </li>
          ))}
        </ul>
      }
      position="bottom"
    >
      {badge}
    </Tooltip>
  );
}

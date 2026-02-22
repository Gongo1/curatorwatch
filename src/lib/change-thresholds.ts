/**
 * Alert type definitions and threshold constants
 *
 * Philosophy: Only 4 alert types that matter to institutional allocators
 * Each alert represents a statistically significant event (<5% frequency)
 */

// Alert types we track
export const ALERT_TYPES = {
  APY_CHANGE: "APY_CHANGE",               // Yield volatility
  LARGE_FLOW: "LARGE_FLOW",               // Capital movement (legacy)
  LARGE_DEPOSIT: "LARGE_DEPOSIT",         // Capital inflow (positive)
  LARGE_WITHDRAWAL: "LARGE_WITHDRAWAL",   // Capital outflow (warning)
  VAULT_LAUNCH: "VAULT_LAUNCH",           // New vault
  VAULT_SHUTDOWN: "VAULT_SHUTDOWN",       // Vault closing
  CONCENTRATION_SPIKE: "CONCENTRATION_SPIKE", // Risk regime change
} as const;

export type AlertType = (typeof ALERT_TYPES)[keyof typeof ALERT_TYPES];
export type Severity = "info" | "warning" | "critical";

// Threshold configuration
export const THRESHOLDS = {
  // APY Changes - compared to 7-day moving average
  APY: {
    WARNING: 20,   // 20-30% change from average
    CRITICAL: 30,  // >30% change from average
  },

  // Large Flows - as percentage of vault TVL
  LARGE_FLOW: {
    WARNING: 10,   // 10-20% of TVL
    CRITICAL: 20,  // >20% of TVL
  },

  // Vault Lifecycle - TVL thresholds
  VAULT_LIFECYCLE: {
    LAUNCH_MIN_TVL: 1_000_000,     // $1M to be considered "launched"
    SHUTDOWN_PREV_MIN: 100_000,    // Previous TVL must be >$100k
    SHUTDOWN_CURR_MAX: 10_000,     // Current TVL must be <$10k
  },

  // Concentration Spikes - percentage point increase in 24h
  CONCENTRATION: {
    WARNING: 15,   // 15-25 percentage point increase
    CRITICAL: 25,  // >25 percentage point increase
  },

  // Time windows
  TIME_WINDOWS: {
    APY_AVERAGE_DAYS: 7,           // 7-day moving average for APY
    LOOKBACK_HOURS: 24,            // Look back 24h for changes
    TRANSACTION_LOOKBACK_HOURS: 24, // Check transactions from last 24h
  },
} as const;

// Alert type metadata for UI
export const ALERT_METADATA: Record<
  AlertType,
  {
    label: string;
    color: string;
    description: string;
  }
> = {
  APY_CHANGE: {
    label: "APY Change",
    color: "blue",
    description:
      "Alerts when APY deviates >20% from 7-day average. Only 5% of daily APY changes exceed this threshold.",
  },
  LARGE_FLOW: {
    label: "Large Flow",
    color: "green",
    description:
      "Deposits/withdrawals exceeding 10% of vault TVL. These represent the top 5% largest transactions.",
  },
  LARGE_DEPOSIT: {
    label: "Capital Inflow",
    color: "green",
    description:
      "Significant deposits exceeding 10% of vault TVL. These represent strong capital inflows.",
  },
  LARGE_WITHDRAWAL: {
    label: "Large Withdrawal",
    color: "red",
    description:
      "Withdrawals exceeding 10% of vault TVL. These may indicate changing investor sentiment.",
  },
  VAULT_LAUNCH: {
    label: "Vault Launch",
    color: "purple",
    description:
      "New vault launches when TVL goes from $0 to >$1M in initial deposits.",
  },
  VAULT_SHUTDOWN: {
    label: "Vault Shutdown",
    color: "red",
    description:
      "Vault shutdown detected when TVL drops from >$100k to near-zero.",
  },
  CONCENTRATION_SPIKE: {
    label: "Concentration Spike",
    color: "yellow",
    description:
      "Rapid increases in single-adapter allocation (>15 percentage points in 24h).",
  },
};

// Legacy exports for backwards compatibility (deprecated)
export const CHANGE_TYPES = ALERT_TYPES;
export type ChangeType = AlertType;

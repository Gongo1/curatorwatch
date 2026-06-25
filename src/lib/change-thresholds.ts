/**
 * Alert type definitions and threshold constants
 *
 * Covers vault-level, curator-level, and ecosystem-level alerts.
 * Each alert represents a statistically significant event (<5% frequency)
 */

// Alert types we track
export const ALERT_TYPES = {
  // Vault-level (stored in VaultChange)
  APY_CHANGE: "APY_CHANGE",               // Yield volatility
  LARGE_FLOW: "LARGE_FLOW",               // Capital movement (legacy)
  LARGE_DEPOSIT: "LARGE_DEPOSIT",         // Capital inflow (positive)
  LARGE_WITHDRAWAL: "LARGE_WITHDRAWAL",   // Capital outflow (warning)
  VAULT_LAUNCH: "VAULT_LAUNCH",           // New vault
  VAULT_SHUTDOWN: "VAULT_SHUTDOWN",       // Vault closing
  CONCENTRATION_SPIKE: "CONCENTRATION_SPIKE", // Risk regime change
  VAULT_TVL_DROP: "VAULT_TVL_DROP",       // Vault TVL fell >10% in 24h (snapshot comparison)
  VAULT_TVL_SURGE: "VAULT_TVL_SURGE",     // Vault TVL grew >25% in 24h (info, positive)

  // Curator-level (stored in PlatformAlert)
  CURATOR_AUM_DROP: "CURATOR_AUM_DROP",   // Curator total AUM fell >5% in 24h or >15% in 72h
  CURATOR_AUM_SURGE: "CURATOR_AUM_SURGE", // Curator total AUM grew >15% in 24h
  DISCLOSURE_CANDIDATE: "DISCLOSURE_CANDIDATE", // Possible off-chain legal/regulatory event — human review → curator-disclosure skill

  // Ecosystem-level (stored in PlatformAlert)
  ECOSYSTEM_AUM_DROP: "ECOSYSTEM_AUM_DROP", // Total platform AUM fell >3% in 24h
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

  // Vault TVL snapshot-to-snapshot changes (% change in 24h)
  VAULT_TVL: {
    WARNING: 10,       // 10-20% drop = warning
    CRITICAL: 20,      // >20% drop = critical
    SURGE_INFO: 25,    // >25% growth = info (positive signal)
  },

  // Curator AUM changes
  CURATOR_AUM: {
    WARNING_24H: 5,    // >5% drop in 24h = warning
    CRITICAL_24H: 10,  // >10% drop in 24h = critical
    CRITICAL_72H: 15,  // >15% drop in 72h = critical (sustained outflow)
    SURGE_INFO: 15,    // >15% growth in 24h = info
  },

  // Ecosystem AUM changes
  ECOSYSTEM_AUM: {
    WARNING_24H: 3,    // >3% drop in 24h = warning
    CRITICAL_24H: 5,   // >5% drop in 24h = critical
  },

  // Minimum AUM to trigger alerts (skip tiny curators/empty ecosystem)
  MIN_CURATOR_AUM: 10_000_000,    // $10M
  MIN_ECOSYSTEM_AUM: 100_000_000, // $100M

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
  VAULT_TVL_DROP: {
    label: "TVL Drop",
    color: "red",
    description:
      "Alerts when a vault's TVL drops >10% compared to 24h ago. Detects distributed outflows that individual transaction alerts miss.",
  },
  VAULT_TVL_SURGE: {
    label: "TVL Surge",
    color: "green",
    description:
      "Alerts when a vault's TVL grows >25% in 24h. Indicates strong capital inflows.",
  },
  CURATOR_AUM_DROP: {
    label: "Curator AUM Drop",
    color: "red",
    description:
      "Alerts when a curator's total AUM drops >5% in 24h or >15% over 3 days.",
  },
  CURATOR_AUM_SURGE: {
    label: "Curator AUM Surge",
    color: "green",
    description:
      "Alerts when a curator's total AUM grows >15% in 24h. Strong growth signal.",
  },
  DISCLOSURE_CANDIDATE: {
    label: "Disclosure Candidate",
    color: "red",
    description:
      "Possible off-chain legal/regulatory/governance event (legal-tagged news or an SEC filing naming the curator). Flagged for human review — not auto-published.",
  },
  ECOSYSTEM_AUM_DROP: {
    label: "Ecosystem AUM Drop",
    color: "red",
    description:
      "Alerts when total platform AUM drops >3% in 24h. Indicates broad-based outflows.",
  },
};

// Legacy exports for backwards compatibility (deprecated)
export const CHANGE_TYPES = ALERT_TYPES;
export type ChangeType = AlertType;

/**
 * Change detection thresholds configuration
 * These values determine when changes are flagged as warnings or critical alerts
 */

export const THRESHOLDS = {
  // TVL (Total Value Locked) changes
  TVL: {
    WARNING: 10, // % change triggers warning
    CRITICAL: 20, // % change triggers critical alert
  },

  // APY (Annual Percentage Yield) changes
  APY: {
    WARNING: 15, // % relative change triggers warning
    CRITICAL: 25, // % relative change triggers critical alert
  },

  // Large transaction detection
  LARGE_TRANSACTION: {
    PERCENT_OF_TVL: 5, // Transaction > 5% of vault TVL
    CRITICAL_PERCENT: 10, // Transaction > 10% of vault TVL is critical
  },

  // Allocation shift detection
  ALLOCATION_SHIFT: {
    WARNING: 10, // Percentage points change in adapter allocation
    CRITICAL: 20, // Percentage points change is critical
  },

  // Share price deviation
  SHARE_PRICE: {
    WARNING: 2, // % change in share price
    CRITICAL: 5, // Critical if share price moves > 5%
  },

  // Time windows (in hours)
  TIME_WINDOWS: {
    RECENT_TRANSACTIONS: 1, // Look back 1 hour for recent transactions
    RECENT_REALLOCATIONS: 1, // Look back 1 hour for recent reallocations
  },
} as const;

// Change types for classification
export const CHANGE_TYPES = {
  TVL_CHANGE: "TVL_CHANGE",
  APY_CHANGE: "APY_CHANGE",
  CONCENTRATION_RISK_CHANGE: "CONCENTRATION_RISK_CHANGE",
  LIQUIDITY_RISK_CHANGE: "LIQUIDITY_RISK_CHANGE",
  DIVERSIFICATION_CHANGE: "DIVERSIFICATION_CHANGE",
  LARGE_DEPOSIT: "LARGE_DEPOSIT",
  LARGE_WITHDRAWAL: "LARGE_WITHDRAWAL",
  REALLOCATION: "REALLOCATION",
  ALLOCATION_SHIFT: "ALLOCATION_SHIFT",
  SHARE_PRICE_CHANGE: "SHARE_PRICE_CHANGE",
  CURATOR_CHANGE: "CURATOR_CHANGE",
} as const;

export type ChangeType = (typeof CHANGE_TYPES)[keyof typeof CHANGE_TYPES];
export type Severity = "info" | "warning" | "critical";

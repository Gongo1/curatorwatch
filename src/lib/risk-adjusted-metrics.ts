/**
 * Risk-Adjusted Metrics Library
 *
 * This module provides calculations for institutional-grade risk metrics
 * commonly used in portfolio analysis and fund evaluation.
 */

/**
 * Calculate the Sharpe Ratio for a given set of returns
 *
 * Sharpe Ratio = (Average Return - Risk Free Rate) / Standard Deviation of Returns
 *
 * @param returns Array of periodic returns (e.g., daily/weekly APY values)
 * @param riskFreeRate The risk-free rate (annualized), default 4% (typical T-bill rate)
 * @returns The Sharpe ratio, or null if insufficient data
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.04
): number | null {
  if (returns.length < 2) return null;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
    (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return null;

  // Annualize if returns are in percentage
  const annualizedReturn = avgReturn;
  const annualizedStdDev = stdDev;

  return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

/**
 * Calculate the Sortino Ratio (downside risk-adjusted return)
 *
 * Sortino Ratio = (Average Return - Target Return) / Downside Deviation
 *
 * @param returns Array of periodic returns
 * @param targetReturn Minimum acceptable return (default: risk-free rate)
 * @returns The Sortino ratio, or null if insufficient data
 */
export function calculateSortinoRatio(
  returns: number[],
  targetReturn: number = 0.04
): number | null {
  if (returns.length < 2) return null;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate downside deviation (only negative deviations from target)
  const downsideReturns = returns.filter((r) => r < targetReturn);
  if (downsideReturns.length === 0) {
    // No downside returns - excellent performance
    return null; // Or return a very high number
  }

  const downsideVariance =
    downsideReturns.reduce(
      (sum, r) => sum + Math.pow(r - targetReturn, 2),
      0
    ) / downsideReturns.length;
  const downsideDeviation = Math.sqrt(downsideVariance);

  if (downsideDeviation === 0) return null;

  return (avgReturn - targetReturn) / downsideDeviation;
}

/**
 * Calculate yield consistency score (0-100)
 *
 * Measures how stable the yield has been over time.
 * Higher score = more consistent yields.
 *
 * @param apyHistory Array of historical APY values
 * @returns Consistency score between 0-100
 */
export function calculateConsistencyScore(apyHistory: number[]): number {
  if (apyHistory.length < 2) return 100; // Assume perfect consistency with minimal data

  const avgApy = apyHistory.reduce((sum, a) => sum + a, 0) / apyHistory.length;
  if (avgApy === 0) return 100;

  // Calculate coefficient of variation (CV)
  const variance =
    apyHistory.reduce((sum, a) => sum + Math.pow(a - avgApy, 2), 0) /
    (apyHistory.length - 1);
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / Math.abs(avgApy);

  // Convert CV to a 0-100 score (lower CV = higher consistency)
  // CV of 0 = 100 score, CV of 1+ = 0 score
  const score = Math.max(0, Math.min(100, (1 - cv) * 100));

  return Math.round(score);
}

/**
 * Calculate maximum drawdown percentage
 *
 * Maximum drawdown measures the largest peak-to-trough decline.
 *
 * @param values Array of values (e.g., TVL or share prices over time)
 * @returns Maximum drawdown as a percentage (0-100)
 */
export function calculateMaxDrawdown(values: number[]): number {
  if (values.length < 2) return 0;

  let maxDrawdown = 0;
  let peak = values[0];

  for (const value of values) {
    if (value > peak) {
      peak = value;
    }
    const drawdown = ((peak - value) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return Math.round(maxDrawdown * 100) / 100;
}

/**
 * Calculate risk-adjusted yield
 *
 * Adjusts the yield based on concentration and diversification risks.
 *
 * @param apy The current APY
 * @param concentrationRisk Concentration score (0-100, higher = more concentrated)
 * @param liquidityRisk Liquidity score (0-100, higher = less liquid)
 * @returns Risk-adjusted yield
 */
export function calculateRiskAdjustedYield(
  apy: number,
  concentrationRisk: number,
  liquidityRisk: number
): number {
  // Risk penalty factor (0.5 to 1.0)
  // Higher risk = lower adjusted yield
  const concentrationPenalty = 1 - (concentrationRisk / 100) * 0.3;
  const liquidityPenalty = 1 - (liquidityRisk / 100) * 0.2;

  const riskAdjustedYield = apy * concentrationPenalty * liquidityPenalty;

  return Math.round(riskAdjustedYield * 100) / 100;
}

/**
 * Calculate Information Ratio
 *
 * Measures excess returns relative to a benchmark per unit of tracking error.
 *
 * @param vaultReturns Array of vault returns
 * @param benchmarkReturns Array of benchmark returns (same length)
 * @returns Information ratio, or null if insufficient data
 */
export function calculateInformationRatio(
  vaultReturns: number[],
  benchmarkReturns: number[]
): number | null {
  if (
    vaultReturns.length < 2 ||
    vaultReturns.length !== benchmarkReturns.length
  ) {
    return null;
  }

  // Calculate excess returns
  const excessReturns = vaultReturns.map((r, i) => r - benchmarkReturns[i]);

  const avgExcessReturn =
    excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;

  // Tracking error (std dev of excess returns)
  const variance =
    excessReturns.reduce(
      (sum, r) => sum + Math.pow(r - avgExcessReturn, 2),
      0
    ) / (excessReturns.length - 1);
  const trackingError = Math.sqrt(variance);

  if (trackingError === 0) return null;

  return avgExcessReturn / trackingError;
}

/**
 * Calculate Calmar Ratio
 *
 * Risk-adjusted return metric using maximum drawdown.
 * Calmar Ratio = Annualized Return / Maximum Drawdown
 *
 * @param annualizedReturn The annualized return
 * @param maxDrawdown Maximum drawdown percentage
 * @returns Calmar ratio, or null if drawdown is zero
 */
export function calculateCalmarRatio(
  annualizedReturn: number,
  maxDrawdown: number
): number | null {
  if (maxDrawdown === 0) return null;

  return annualizedReturn / maxDrawdown;
}

/**
 * Calculate volatility (standard deviation of returns)
 *
 * @param returns Array of returns
 * @returns Volatility as percentage
 */
export function calculateVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const squaredDiffs = returns.map((r) => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (returns.length - 1);

  return Math.sqrt(variance);
}

/**
 * Calculate win rate (percentage of positive periods)
 *
 * @param returns Array of returns
 * @returns Win rate as percentage (0-100)
 */
export function calculateWinRate(returns: number[]): number {
  if (returns.length === 0) return 0;

  const positiveReturns = returns.filter((r) => r > 0).length;
  return Math.round((positiveReturns / returns.length) * 100);
}

/**
 * Comprehensive risk metrics for a vault
 */
export interface RiskMetrics {
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  consistencyScore: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  riskAdjustedYield: number | null;
  calmarRatio: number | null;
}

/**
 * Calculate all risk metrics for a vault
 *
 * @param apyHistory Historical APY values
 * @param tvlHistory Historical TVL values (for drawdown)
 * @param currentApy Current APY
 * @param concentrationRisk Concentration risk score (0-100)
 * @param liquidityRisk Liquidity risk score (0-100)
 * @param riskFreeRate Risk-free rate for Sharpe calculation
 * @returns Complete risk metrics object
 */
export function calculateAllRiskMetrics(
  apyHistory: number[],
  tvlHistory: number[],
  currentApy: number,
  concentrationRisk: number = 50,
  liquidityRisk: number = 50,
  riskFreeRate: number = 0.04
): RiskMetrics {
  const sharpeRatio = calculateSharpeRatio(apyHistory, riskFreeRate);
  const sortinoRatio = calculateSortinoRatio(apyHistory, riskFreeRate);
  const consistencyScore = calculateConsistencyScore(apyHistory);
  const maxDrawdown = calculateMaxDrawdown(tvlHistory);
  const volatility = calculateVolatility(apyHistory);
  const winRate = calculateWinRate(apyHistory);
  const riskAdjustedYield = currentApy
    ? calculateRiskAdjustedYield(currentApy, concentrationRisk, liquidityRisk)
    : null;
  const calmarRatio =
    currentApy && maxDrawdown > 0
      ? calculateCalmarRatio(currentApy, maxDrawdown)
      : null;

  return {
    sharpeRatio,
    sortinoRatio,
    consistencyScore,
    maxDrawdown,
    volatility,
    winRate,
    riskAdjustedYield,
    calmarRatio,
  };
}

/**
 * Get risk grade based on metrics
 */
export function getRiskGrade(metrics: RiskMetrics): {
  grade: "A" | "B" | "C" | "D" | "F";
  label: string;
  description: string;
} {
  let score = 0;

  // Sharpe Ratio contribution (0-25 points)
  if (metrics.sharpeRatio !== null) {
    if (metrics.sharpeRatio >= 2) score += 25;
    else if (metrics.sharpeRatio >= 1) score += 20;
    else if (metrics.sharpeRatio >= 0.5) score += 15;
    else if (metrics.sharpeRatio >= 0) score += 10;
    else score += 5;
  }

  // Consistency Score contribution (0-25 points)
  score += (metrics.consistencyScore / 100) * 25;

  // Max Drawdown contribution (0-25 points)
  if (metrics.maxDrawdown <= 5) score += 25;
  else if (metrics.maxDrawdown <= 10) score += 20;
  else if (metrics.maxDrawdown <= 20) score += 15;
  else if (metrics.maxDrawdown <= 30) score += 10;
  else score += 5;

  // Win Rate contribution (0-25 points)
  score += (metrics.winRate / 100) * 25;

  if (score >= 85) {
    return {
      grade: "A",
      label: "Excellent",
      description: "Strong risk-adjusted performance with high consistency",
    };
  } else if (score >= 70) {
    return {
      grade: "B",
      label: "Good",
      description: "Above-average risk-adjusted returns",
    };
  } else if (score >= 55) {
    return {
      grade: "C",
      label: "Average",
      description: "Standard risk-return profile",
    };
  } else if (score >= 40) {
    return {
      grade: "D",
      label: "Below Average",
      description: "Higher risk relative to returns",
    };
  } else {
    return {
      grade: "F",
      label: "Poor",
      description: "Significant risk concerns",
    };
  }
}

/**
 * Format risk metric for display
 */
export function formatRiskMetric(
  value: number | null,
  type: "ratio" | "percentage" | "score"
): string {
  if (value === null) return "N/A";

  switch (type) {
    case "ratio":
      return value.toFixed(2);
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "score":
      return value.toString();
    default:
      return value.toString();
  }
}

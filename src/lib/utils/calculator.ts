// Pure calculation functions for LP Allocation Calculator
// Turtle vaults use simple interest (APR), Morpho vaults use compound interest (APY)

export interface MonthlyPayment {
  month: number;
  payment: number;
  cumulative: number;
  balance: number;
}

export interface CalculatorResult {
  schedule: MonthlyPayment[];
  chartData: { month: number; principal: number; earnings: number }[];
  totalEarnings: number;
  firstMonthEarnings: number;
  yearOneTotal: number;
}

/**
 * Calculate vault earnings with a monthly schedule.
 *
 * @param principal  - Deposit amount in USD
 * @param months     - Projection timeframe in months
 * @param dataSource - "turtle" (simple interest) or "morpho" (compound)
 * @param netAPR     - Post-fee APR as a percentage (e.g. 5.25 means 5.25%)
 * @param avgNetApy  - Post-fee APY as a decimal (e.g. 0.0525 means 5.25%) — Morpho only
 */
export function calculateVaultEarnings(
  principal: number,
  months: number,
  dataSource: string,
  netAPR: number | null | undefined,
  avgNetApy: number | null | undefined,
): CalculatorResult {
  if (dataSource === "turtle") {
    return calculateSimpleInterest(principal, months, netAPR ?? 0);
  }
  return calculateCompoundInterest(principal, months, avgNetApy ?? 0);
}

/**
 * Turtle: simple interest — equal monthly payments.
 * earnings = principal * (rate/100) * (months/12)
 */
function calculateSimpleInterest(
  principal: number,
  months: number,
  netAPR: number,
): CalculatorResult {
  const annualRate = netAPR / 100;
  const monthlyPayment = (principal * annualRate) / 12;

  const schedule: MonthlyPayment[] = [];
  const chartData: CalculatorResult["chartData"] = [];

  for (let m = 1; m <= months; m++) {
    const cumulative = monthlyPayment * m;
    schedule.push({
      month: m,
      payment: monthlyPayment,
      cumulative,
      balance: principal + cumulative,
    });
    chartData.push({
      month: m,
      principal,
      earnings: cumulative,
    });
  }

  const totalEarnings = monthlyPayment * months;
  const yearOneMonths = Math.min(months, 12);

  return {
    schedule,
    chartData,
    totalEarnings,
    firstMonthEarnings: monthlyPayment,
    yearOneTotal: monthlyPayment * yearOneMonths,
  };
}

/**
 * Morpho: compound interest — balance grows each month.
 * monthlyRate = (1 + avgNetApy)^(1/12) - 1
 * balance(m) = principal * (1 + monthlyRate)^m
 */
function calculateCompoundInterest(
  principal: number,
  months: number,
  avgNetApy: number,
): CalculatorResult {
  const monthlyRate = Math.pow(1 + avgNetApy, 1 / 12) - 1;

  const schedule: MonthlyPayment[] = [];
  const chartData: CalculatorResult["chartData"] = [];

  let prevBalance = principal;

  for (let m = 1; m <= months; m++) {
    const balance = principal * Math.pow(1 + monthlyRate, m);
    const payment = balance - prevBalance;
    const cumulative = balance - principal;

    schedule.push({
      month: m,
      payment,
      cumulative,
      balance,
    });
    chartData.push({
      month: m,
      principal,
      earnings: cumulative,
    });

    prevBalance = balance;
  }

  const finalBalance = principal * Math.pow(1 + monthlyRate, months);
  const totalEarnings = finalBalance - principal;
  const yearOneBalance = principal * Math.pow(1 + monthlyRate, Math.min(months, 12));

  return {
    schedule,
    chartData,
    totalEarnings,
    firstMonthEarnings: principal * monthlyRate,
    yearOneTotal: yearOneBalance - principal,
  };
}

/**
 * Quick helper for homepage VaultFinder — annual earnings on a deposit.
 */
export function calculateAnnualEarnings(
  deposit: number,
  dataSource: string,
  netAPR: number | null | undefined,
  avgNetApy: number | null | undefined,
): number {
  if (dataSource === "turtle") {
    return deposit * ((netAPR ?? 0) / 100);
  }
  // Morpho: compound
  return deposit * (avgNetApy ?? 0);
}

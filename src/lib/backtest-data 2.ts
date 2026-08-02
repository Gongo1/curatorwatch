// Bundled backtest summary (static import — ships inside the serverless function).
// Refreshed weekly alongside ratings.json (refresh.sh emits it from the engine's
// validation_<run>.json). Surfaced by BacktestPanel on /ratings, feature-flagged.
import backtest from "../../data/risk-engine/backtest.json";

export interface BacktestSummary {
  method: string;
  cutoff_month: string;
  trained_with_zero_events: boolean;
  train_vault_months: number;
  test_vault_months: number;
  test_events: number;
  auc: number;
  top_quartile_lift: number;
  brier: number;
  divergences: number;
  max_rhat: number;
  panel_vault_months: number;
  methodology_version: string;
  generated_at: string;
}

export const backtestSummary = backtest as BacktestSummary;

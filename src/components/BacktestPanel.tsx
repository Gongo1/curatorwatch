import { backtestSummary as b } from "@/lib/backtest-data";

// Productized backtest credibility panel (Phase 3). Surfaces the engine's pre-event
// temporal backtest: trained before the Stream collapse with ZERO loss events, it
// still ranked the eventual losers low. Server component, reads the bundled summary.
export function BacktestPanel() {
  return (
    <section className="rounded-2xl border border-border bg-background-subtle p-5 sm:p-6 mb-8">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-text-tertiary">
        Does it actually work?
        <span className="rounded-full border border-accent-green/30 bg-accent-green/10 px-1.5 py-px text-[10px] font-semibold text-accent-green">
          Backtested
        </span>
      </div>
      <p className="mt-2 font-mono text-sm leading-relaxed text-text-secondary max-w-[680px]">
        Fit on everything <span className="text-text-primary">before November 2025 with zero loss
        events in the training data</span> — structure and priors only — then asked to rank curators
        going into the Stream-collapse window. It put the {b.test_events} curators that actually took
        losses in the riskiest quartile{" "}
        <span className="text-accent-green font-semibold">{b.top_quartile_lift.toFixed(1)}× more often than chance</span>.
        This is the honest test: rate the losers low <em>in advance</em>.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-5 bg-border rounded-xl overflow-hidden">
        <Stat label="Top-quartile lift" value={`${b.top_quartile_lift.toFixed(1)}×`} sub="vs. random ranking" accent />
        <Stat label="Discrimination (AUC)" value={b.auc.toFixed(2)} sub="0.5 = coin flip" />
        <Stat label="Pre-event test" value={`${b.test_events}`} sub="real losses ranked" />
        <Stat label="Survival panel" value={`${(b.panel_vault_months / 1000).toFixed(1)}k`} sub="vault-months" />
      </div>

      <p className="mt-4 font-mono text-[11px] leading-relaxed text-text-tertiary">
        Pre-event temporal backtest, cutoff {b.cutoff_month}. Converged clean
        ({b.divergences} divergences, r̂ {b.max_rhat.toFixed(3)}). Honest caveat: structural
        features are current-book, so this tests model form + cross-sectional discrimination,
        not a full point-in-time replay. {b.methodology_version}.
      </p>
    </section>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="bg-background-subtle p-4">
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-text-tertiary">{label}</div>
      <div className={`font-mono text-2xl font-semibold tabular-nums mt-1 ${accent ? "text-accent-green" : "text-text-primary"}`}>
        {value}
      </div>
      <div className="font-mono text-[0.6rem] text-text-tertiary mt-0.5">{sub}</div>
    </div>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";

export default function DocsPage() {
  return (
    <>
      <PageHeader
        title="Documentation"
        description="How CuratorWatch evaluates and classifies vaults"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Documentation" },
        ]}
      />

      <div className="max-w-[800px] space-y-8">
        {/* LP Calculator Overview */}
        <section>
          <h2 className="text-lg font-bold text-text-primary mb-3">
            LP Return Calculator
          </h2>
          <div className="bg-background-subtle rounded-xl border border-border p-5 space-y-3 text-sm text-text-secondary leading-relaxed">
            <p>
              The LP Return Calculator helps you find vaults that match your risk
              appetite and project earnings over time. You select a deposit amount,
              vault grade (High Grade or Other), and collateral type (Blue-Chip or
              All), then CuratorWatch filters the full vault set and ranks matches
              by current rate.
            </p>
            <p>
              Advanced filters let you narrow by protocol (Morpho, Turtle, etc.),
              specific asset, curator, and APR range. Clicking a vault shows a
              12-month growth chart, monthly payment schedule, and liquidity check
              comparing your deposit to vault TVL.
            </p>
            <p>
              Projections use each vault&apos;s current net rate. Morpho vaults compound
              continuously (APY), while Turtle vaults pay periodically (APR).
              Actual returns will vary as rates change over time.
            </p>
          </div>
        </section>

        {/* High Grade vs Other */}
        <section>
          <h2 className="text-lg font-bold text-text-primary mb-3">
            High Grade vs Other
          </h2>
          <div className="bg-background-subtle rounded-xl border border-border p-5 space-y-3 text-sm text-text-secondary leading-relaxed">
            <p>
              Every active vault receives a composite risk score from 0 to 100 and
              is checked against nine hard requirements. The number of requirements
              a vault fails determines its grade:
            </p>
            <div className="space-y-2 my-2">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 bg-accent-green/10 text-accent-green text-xs rounded font-semibold border border-accent-green/20 w-32 text-center">
                  High Grade
                </span>
                <span>Pass all 9 requirements &mdash; no failures</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 bg-accent-yellow/10 text-accent-yellow text-xs rounded font-semibold border border-accent-yellow/20 w-32 text-center">
                  Medium Grade
                </span>
                <span>Fail 1-3 requirements (pass 6-8)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 bg-accent-red/10 text-accent-red text-xs rounded font-semibold border border-accent-red/20 w-32 text-center">
                  Low Grade
                </span>
                <span>Fail 4+ requirements (pass 5 or fewer)</span>
              </div>
            </div>
            <p>
              The nine hard requirements ensure only vaults with sufficient size,
              established curators, clean debt history, reasonable yields, and
              institutional-quality collateral earn the High Grade label.
            </p>
          </div>
        </section>

        {/* Hard Requirements */}
        <section>
          <h2 className="text-lg font-bold text-text-primary mb-3">
            Hard Requirements (must pass all 9)
          </h2>
          <div className="bg-background-subtle rounded-xl border border-border overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-background-elevated border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">#</th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Requirement</th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {[
                  ["1", "Vault TVL", ">= $1 million"],
                  ["2", "Curator has legal entity", "entityType is not null"],
                  ["3", "Curator operating time", ">= 6 months"],
                  ["4", "Curator total AUM", ">= $10 million"],
                  ["5", "Curator bad debt", "Zero (any bad debt = disqualified)"],
                  ["6", "Vault bad debt (liquidations)", "Zero"],
                  ["7", "APR / APY", "<= 20%"],
                  ["8", "Institutional collateral", ">= 80% blue-chip assets"],
                  ["9", "Vault age", ">= 90 days (when data available)"],
                ].map(([num, label, threshold]) => (
                  <tr key={num} className="hover:bg-background-hover transition-colors">
                    <td className="px-4 py-2.5 text-text-muted tabular-nums">{num}</td>
                    <td className="px-4 py-2.5 text-text-primary">{label}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{threshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-muted mt-2">
            If any single requirement fails, the vault is classified as &ldquo;Other&rdquo;
            regardless of its score.
          </p>
        </section>

        {/* 5-Factor Scoring */}
        <section>
          <h2 className="text-lg font-bold text-text-primary mb-3">
            5-Factor Scoring Model (100 points)
          </h2>
          <div className="space-y-4">
            {/* Size */}
            <div className="bg-background-subtle rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary">Size</h3>
                <span className="text-xs font-medium text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded">
                  0-25 pts
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-3">
                Larger vaults are harder to manipulate and signal market confidence.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[
                  ["$100M+", "25"],
                  ["$50M+", "22"],
                  ["$20M+", "18"],
                  ["$10M+", "14"],
                  ["$5M+", "10"],
                  ["$1M+", "5"],
                  ["< $1M", "0"],
                ].map(([tvl, pts]) => (
                  <div key={tvl} className="flex justify-between bg-background-elevated rounded px-3 py-1.5 border border-border">
                    <span className="text-text-secondary">{tvl}</span>
                    <span className="font-semibold text-text-primary">{pts} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Maturity */}
            <div className="bg-background-subtle rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary">Maturity</h3>
                <span className="text-xs font-medium text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded">
                  0-15 pts
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-3">
                Older vaults have survived more market conditions. Measured in days live.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {[
                  ["730+ days", "15"],
                  ["365+ days", "13"],
                  ["180+ days", "10"],
                  ["90+ days", "5"],
                  ["< 90 days", "0"],
                ].map(([age, pts]) => (
                  <div key={age} className="flex justify-between bg-background-elevated rounded px-3 py-1.5 border border-border">
                    <span className="text-text-secondary">{age}</span>
                    <span className="font-semibold text-text-primary">{pts} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Curator */}
            <div className="bg-background-subtle rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary">Curator</h3>
                <span className="text-xs font-medium text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded">
                  0-35 pts
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-3">
                The largest weight. Evaluates the entity managing the vault.
                Returns 0 if the curator has no legal entity or any bad debt.
              </p>
              <div className="space-y-2 text-sm text-text-secondary">
                <div className="flex items-start gap-2">
                  <span className="text-text-muted flex-shrink-0 w-20 text-right font-medium">10 pts</span>
                  <span>Legal entity exists (LLC, Corporation, DAO, etc.)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-text-muted flex-shrink-0 w-20 text-right font-medium">0-15 pts</span>
                  <span>Time in operation (6mo = 5pts, 12mo = 9, 18mo = 12, 24mo+ = 15)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-text-muted flex-shrink-0 w-20 text-right font-medium">0-5 pts</span>
                  <span>Total AUM ($10M = 2pts, $50M = 3, $100M = 4, $500M+ = 5)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-text-muted flex-shrink-0 w-20 text-right font-medium">5 pts</span>
                  <span>Zero bad debt (any bad debt = entire curator score drops to 0)</span>
                </div>
              </div>
            </div>

            {/* Collateral */}
            <div className="bg-background-subtle rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary">Collateral Quality</h3>
                <span className="text-xs font-medium text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded">
                  0-15 pts
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-3">
                Higher scores for vaults backed by institutional-grade assets.
                Three tiers of recognized collateral:
              </p>
              <div className="space-y-2 text-sm text-text-secondary mb-3">
                <div className="flex items-start gap-2">
                  <span className="font-medium text-text-primary flex-shrink-0 w-12">Tier 1</span>
                  <span>Major stablecoins &mdash; USDC, USDT, DAI</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-text-primary flex-shrink-0 w-12">Tier 2</span>
                  <span>Blue-chip crypto &mdash; wstETH, WETH, WBTC</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-text-primary flex-shrink-0 w-12">Tier 3</span>
                  <span>Regulated stablecoins &mdash; EURC, USDA, PYUSD</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["100% Tier 1", "15"],
                  ["100% Tier 1+2", "13"],
                  ["90%+ blue-chip", "10"],
                  ["80%+ blue-chip", "8"],
                  ["60%+ blue-chip", "5"],
                  ["< 60%", "0"],
                ].map(([desc, pts]) => (
                  <div key={desc} className="flex justify-between bg-background-elevated rounded px-3 py-1.5 border border-border">
                    <span className="text-text-secondary">{desc}</span>
                    <span className="font-semibold text-text-primary">{pts} pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Indicators */}
            <div className="bg-background-subtle rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-text-primary">Risk Indicators</h3>
                <span className="text-xs font-medium text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded">
                  0-10 pts
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-3">
                Two sub-checks: liquidation history (0-5) and APR sanity (0-5).
              </p>
              <div className="space-y-2 text-sm text-text-secondary">
                <div className="flex items-start gap-2">
                  <span className="font-medium text-text-muted flex-shrink-0 w-28">Liquidations</span>
                  <span>0 events = 5pts, 1-5 = 3pts, 6-10 = 2pts, 11+ = 1pt, bad debt = 0pts</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-text-muted flex-shrink-0 w-28">APR sanity</span>
                  <span>&le;20% APR = 5pts, &gt;20% = 0pts (unsustainable yield signal)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How Grading Works */}
        <section>
          <h2 className="text-lg font-bold text-text-primary mb-3">
            How Grading Works
          </h2>
          <div className="bg-background-subtle rounded-xl border border-border p-5 space-y-3 text-sm text-text-secondary leading-relaxed">
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Every active vault is scored across all 5 factors (sum = 0-100).
              </li>
              <li>
                Each vault is checked against the 9 hard requirements. The number
                of failures determines the grade.
              </li>
              <li>
                <strong>0 failures</strong> = High Grade &mdash; passes every check.
              </li>
              <li>
                <strong>1-3 failures</strong> = Medium Grade &mdash; close but missing
                a few requirements.
              </li>
              <li>
                <strong>4+ failures</strong> = Low Grade &mdash; significant gaps in
                size, curator profile, or collateral quality.
              </li>
            </ol>
            <p>
              Grades are recalculated every time data is collected (hourly for
              snapshot data). As vault metrics change &mdash; TVL grows, curators
              add legal entities, bad debt events occur &mdash; vaults can gain or
              lose their High Grade status.
            </p>
          </div>
        </section>

        {/* Blue-Chip Assets */}
        <section>
          <h2 className="text-lg font-bold text-text-primary mb-3">
            Blue-Chip Asset List
          </h2>
          <div className="bg-background-subtle rounded-xl border border-border p-5 text-sm text-text-secondary leading-relaxed">
            <p className="mb-3">
              Assets recognized as &ldquo;institutional grade&rdquo; for collateral scoring
              and the calculator&apos;s Blue-Chip filter:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "USDC", "USDT", "DAI", "FRAX", "LUSD", "crvUSD", "GHO", "PYUSD",
                "USDS", "EURC", "USDA", "sDAI", "sUSDe", "USDe",
                "WETH", "wstETH", "stETH", "rETH", "cbETH", "weETH", "ezETH",
                "WBTC", "cbBTC", "tBTC", "LBTC",
                "MKR", "AAVE", "CRV", "LDO", "UNI", "LINK",
              ].map((symbol) => (
                <span
                  key={symbol}
                  className="px-2 py-0.5 text-xs font-medium rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                >
                  {symbol}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-muted">
              This list is maintained in the codebase and updated as the DeFi
              ecosystem evolves. Not all blue-chip assets are shown above &mdash;
              the full list includes additional wrapped, staked, and vault token
              variants.
            </p>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="pb-8">
          <div className="rounded-xl border border-accent-yellow/30 bg-accent-yellow/5 p-5 text-sm text-text-secondary leading-relaxed">
            <p className="font-semibold text-text-primary mb-1">Disclaimer</p>
            <p>
              CuratorWatch grades are informational and do not constitute financial
              advice. &ldquo;High Grade&rdquo; reflects relative standing among tracked vaults
              based on publicly available on-chain data &mdash; it does not guarantee
              safety, returns, or solvency. Always do your own research before
              allocating capital.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

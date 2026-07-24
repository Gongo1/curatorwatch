import { PageHeader } from "@/components/layout/PageHeader";

export default function DocsPage() {
  return (
    <>
      <PageHeader
        title="Documentation"
        description="How CuratorWatch tracks curators and vaults"
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
              The LP Return Calculator helps you find vaults and project earnings
              over time. You select a deposit amount and collateral type (Blue-Chip
              or All), then CuratorWatch filters the full vault set and ranks
              matches by current rate.
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

        {/* Data & freshness */}
        <section>
          <h2 className="text-lg font-bold text-text-primary mb-3">
            Data Sources &amp; Freshness
          </h2>
          <div className="bg-background-subtle rounded-xl border border-border p-5 space-y-3 text-sm text-text-secondary leading-relaxed">
            <p>
              CuratorWatch collects vault, curator, allocation, and liquidation
              data on a recurring cycle (every 6 hours for snapshots, with a daily
              full sync). Pages read from these precomputed snapshots, and each
              page shows a &ldquo;data as of&rdquo; stamp where it applies.
            </p>
            <p>
              Change detection runs on every collection cycle: TVL moves, APY
              shifts, fee changes, allocation reallocations, and liquidation
              events surface in the Alerts feed and on each curator&apos;s timeline.
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
              Assets recognized as blue-chip for the calculator&apos;s Blue-Chip filter:
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
              CuratorWatch data is informational and does not constitute financial
              advice. All figures reflect publicly available on-chain data and do
              not guarantee safety, returns, or solvency. Always do your own
              research before allocating capital.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";

// These documents are written in Simplified Technical English (ASD-STE100):
// short active sentences, one idea per sentence, present tense, and one term
// for one meaning. Keep that style when you edit this page.

export const metadata: Metadata = {
  title: "Documentation - CuratorWatch",
  description:
    "How to read CuratorWatch: curators, vaults, the calculator, alerts, the Curator Daily, data sources, and a glossary. Written in Simplified Technical English.",
};

const TOC: { id: string; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "home", label: "The home page" },
  { id: "curators", label: "Curator profiles" },
  { id: "vaults", label: "Vault pages" },
  { id: "calculator", label: "LP Return Calculator" },
  { id: "alerts", label: "Alerts" },
  { id: "digest", label: "Curator Daily & stress index" },
  { id: "compare", label: "Compare" },
  { id: "accounts", label: "Accounts" },
  { id: "data", label: "Data & freshness" },
  { id: "assets", label: "Blue-chip assets" },
  { id: "glossary", label: "Glossary" },
  { id: "disclaimer", label: "Disclaimer" },
];

const BLUE_CHIP = [
  "USDC", "USDT", "DAI", "FRAX", "LUSD", "crvUSD", "GHO", "PYUSD",
  "USDS", "EURC", "USDA", "sDAI", "sUSDe", "USDe",
  "WETH", "wstETH", "stETH", "rETH", "cbETH", "weETH", "ezETH",
  "WBTC", "cbBTC", "tBTC", "LBTC",
  "MKR", "AAVE", "CRV", "LDO", "UNI", "LINK",
];

const GLOSSARY: { term: string; def: string }[] = [
  { term: "Curator", def: "A team that manages a vault. The curator picks the markets, sets the limits, and moves the deposits." },
  { term: "Vault", def: "A smart contract that takes deposits and lends them to markets. One curator manages each vault." },
  { term: "Liquidity provider (LP)", def: "A person or company that deposits money into a vault." },
  { term: "Market", def: "One lending pair. A vault lends to one or more markets." },
  { term: "Allocation", def: "The money that a vault puts into one market." },
  { term: "TVL (total value locked)", def: "The total money in a vault, or across a curator, in US dollars." },
  { term: "AUM (assets under management)", def: "The total money that one curator manages. CuratorWatch uses TVL and AUM for the same value." },
  { term: "APY (annual percentage yield)", def: "The yearly rate with compound interest. Morpho vaults use APY." },
  { term: "APR (annual percentage rate)", def: "The yearly rate without compound interest. Turtle vaults use APR." },
  { term: "Net rate", def: "The rate after the fees." },
  { term: "Performance fee", def: "The part of the yield that the curator keeps." },
  { term: "Liquidation", def: "The sale of collateral when a borrower does not keep enough collateral." },
  { term: "Bad debt", def: "A loss that stays after a liquidation. The vault cannot get this money back." },
  { term: "Curator Stress Index", def: "A score from 0 to 100. A high score shows more risk in the tracked set." },
  { term: "Dossier", def: "The set of facts about a curator: the company, the people, and the history." },
  { term: "Blue-chip asset", def: "A large and liquid token. The calculator can filter for these assets." },
  { term: "Snapshot", def: "A saved copy of the data at one time. Pages read from the snapshots." },
];

function DocSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-xl font-bold text-text-primary mb-3">{title}</h2>
      <div className="space-y-3 text-[15px] text-text-secondary leading-relaxed">{children}</div>
    </section>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="list-decimal pl-5 space-y-1.5 marker:text-text-tertiary marker:font-mono">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-accent-blue flex-none">›</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-accent-yellow/30 bg-accent-yellow/5 px-4 py-3 text-sm text-text-secondary">
      <span className="font-mono text-[11px] uppercase tracking-wide text-accent-yellow">Note</span>{" "}
      {children}
    </div>
  );
}

export default function DocsPage() {
  return (
    <>
      <PageHeader
        title="Documentation"
        description="How to read CuratorWatch"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Documentation" },
        ]}
      />

      <p className="max-w-[760px] text-sm text-text-tertiary mb-8">
        These documents use Simplified Technical English (ASD-STE100). The
        sentences are short and direct on purpose.
      </p>

      <div className="grid lg:grid-cols-[200px_minmax(0,1fr)] gap-10 items-start">
        {/* Sticky table of contents */}
        <nav className="hidden lg:block sticky top-24">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-tertiary mb-3">
            On this page
          </div>
          <ul className="space-y-1.5">
            {TOC.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`} className="text-sm text-text-secondary hover:text-accent-blue transition-colors">
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="max-w-[760px] space-y-12 min-w-0">
          <DocSection id="overview" title="Overview">
            <p>CuratorWatch tracks the curators of DeFi vaults.</p>
            <p>
              A curator is the risk team behind a vault. The curator picks the
              lending markets, sets the exposure limits, and moves the deposits.
            </p>
            <p>
              A person who deposits into a vault is a liquidity provider (LP).
              The LP gives these decisions to the curator. In return, the LP
              gets yield.
            </p>
            <p>
              The important question is not the vault. The important question is
              the curator. CuratorWatch shows who the curators are, what they
              manage, and how their products perform.
            </p>
            <p>CuratorWatch is for three groups:</p>
            <Bullets
              items={[
                "Institutional allocators who choose where to put money.",
                "Curators who want to see the market and their peers.",
                "Researchers who study the vault ecosystem.",
              ]}
            />
          </DocSection>

          <DocSection id="home" title="The home page">
            <p>The home page shows the whole tracked market. It has these parts:</p>
            <Bullets
              items={[
                <><b className="text-text-primary">Tracked TVL</b> — the total money across all curators.</>,
                <><b className="text-text-primary">Asset mix</b> — the split of the money by asset. The bar shows the largest assets.</>,
                <><b className="text-text-primary">Curator Stress Index</b> — the current risk score and the 7-day trend.</>,
                <><b className="text-text-primary">Newswire</b> — recent news that names a tracked curator.</>,
                <><b className="text-text-primary">TVL by curator</b> — a 30-day chart of the top curators.</>,
                <><b className="text-text-primary">All curators</b> — the full list, ranked by TVL. You can search and sort the list.</>,
              ]}
            />
            <Note>
              An account is necessary to see more than the top 3 rows of the
              curator list. See <a href="#accounts" className="text-accent-blue">Accounts</a>.
            </Note>
          </DocSection>

          <DocSection id="curators" title="Curator profiles">
            <p>Each curator has a profile page. The page has these parts:</p>
            <Bullets
              items={[
                <><b className="text-text-primary">About</b> — a short summary. It shows the vault count, the money, the assets, and the strategy. For the top curators, it also shows the company facts, the backers, and a quote from the press.</>,
                <><b className="text-text-primary">Total value locked</b> — the money that the curator manages now.</>,
                <><b className="text-text-primary">Track record</b> — the money over time.</>,
                <><b className="text-text-primary">Changes and alerts</b> — the recent events for the curator.</>,
                <><b className="text-text-primary">Vaults</b> — the list of the vaults. Each row shows the asset, the TVL, the net APY, and the fee. You can sort the table.</>,
                <><b className="text-text-primary">Liquidations</b> — the liquidation events and any bad debt.</>,
                <><b className="text-text-primary">Top depositors</b> — the largest deposits into the vaults of the curator.</>,
              ]}
            />
            <p>
              The Compare action opens the compare page with this curator. See{" "}
              <a href="#compare" className="text-accent-blue">Compare</a>.
            </p>
          </DocSection>

          <DocSection id="vaults" title="Vault pages">
            <p>Each vault has a page with tabs:</p>
            <Bullets
              items={[
                <><b className="text-text-primary">Overview</b> — the key numbers: TVL, net APY, fees, asset, and chain.</>,
                <><b className="text-text-primary">Markets</b> — the markets that the vault lends to, and the size of each allocation.</>,
                <><b className="text-text-primary">Activity</b> — the recent deposits, withdrawals, and changes.</>,
                <><b className="text-text-primary">Strategy</b> — notes on how the curator runs the vault.</>,
              ]}
            />
            <p>
              To open the vault on its protocol, use the external link. This link
              leaves CuratorWatch.
            </p>
          </DocSection>

          <DocSection id="calculator" title="LP Return Calculator">
            <p>The calculator helps you find a vault and project the earnings.</p>
            <p>To use the calculator:</p>
            <Steps
              items={[
                "Enter a deposit amount.",
                "Select a collateral type: Blue-Chip or All.",
                "Read the ranked list of the vaults. CuratorWatch ranks the list by the current rate.",
                "Use the filters to narrow the list by protocol, asset, curator, or rate range.",
                "Select a vault to see the details.",
              ]}
            />
            <p>
              The vault view shows a 12-month growth chart, a monthly schedule,
              and a liquidity check. The liquidity check compares your deposit to
              the vault TVL.
            </p>
            <p>
              The projection uses the current net rate of the vault. Morpho
              vaults compound the yield (APY). Turtle vaults pay the yield at set
              times (APR).
            </p>
            <Note>The real returns change as the rates change. The projection is not a guarantee.</Note>
          </DocSection>

          <DocSection id="alerts" title="Alerts">
            <p>CuratorWatch finds important changes and sends alerts. There are four alert types:</p>
            <Bullets
              items={[
                <><b className="text-text-primary">Large flow</b> — a big deposit or withdrawal.</>,
                <><b className="text-text-primary">APY change</b> — a large move in the rate.</>,
                <><b className="text-text-primary">Concentration</b> — a change in how much one manager holds.</>,
                <><b className="text-text-primary">Lifecycle</b> — a new vault, or the end of a vault.</>,
              ]}
            />
            <p>To get alerts by email:</p>
            <Steps
              items={[
                "Open the Alerts page.",
                "Select the curators that you want to follow.",
                "Enter your email address.",
                "Confirm the email.",
              ]}
            />
            <p>
              You can also get the daily digest email. See{" "}
              <a href="#digest" className="text-accent-blue">Curator Daily</a>.
            </p>
          </DocSection>

          <DocSection id="digest" title="Curator Daily & stress index">
            <p>The Curator Daily is a daily email and a web page. It shows:</p>
            <Bullets
              items={[
                "The flows and the yield moves in the last 24 hours.",
                "The new vaults and the liquidation incidents.",
                "The recent news as links.",
                "One curator spotlight, with the facts and a quote.",
              ]}
            />
            <p>CuratorWatch sends the Curator Daily every day at 05:30 UTC.</p>
            <p>
              The Curator Stress Index is a score from 0 to 100. A low score
              shows a calm market. A high score shows more risk. The score has
              five bands:
            </p>
            <Bullets
              items={[
                "Calm — 0 to 19.",
                "Normal — 20 to 39.",
                "Elevated — 40 to 59.",
                "Stressed — 60 to 79.",
                "Critical — 80 to 100.",
              ]}
            />
            <p>The home page shows the current score and the 7-day trend.</p>
          </DocSection>

          <DocSection id="compare" title="Compare">
            <p>The compare page shows up to four curators side by side.</p>
            <p>To compare curators:</p>
            <Steps
              items={[
                "Open a curator profile.",
                "Select Compare.",
                "Add more curators on the compare page.",
              ]}
            />
            <p>The page shows the TVL, the strategy, the assets, and the yields for each curator.</p>
          </DocSection>

          <DocSection id="accounts" title="Accounts">
            <p>A free account is necessary to see the full data.</p>
            <p>
              An anonymous visitor sees three surfaces only: the home page (the
              top 3 rows), these documents, and the changelog. The other pages
              ask you to sign in.
            </p>
            <p>To create an account:</p>
            <Steps
              items={[
                "Select Create account or Sign in.",
                "Enter your email address.",
                "Enter the 6-digit code from the email.",
                "Choose a handle.",
              ]}
            />
            <p>CuratorWatch does not use a password. You sign in with a new code each time.</p>
          </DocSection>

          <DocSection id="data" title="Data & freshness">
            <p>
              CuratorWatch collects the data from public sources: Morpho, Turtle,
              Euler, Centrifuge, Upshift, and Hyperliquid.
            </p>
            <p>
              The collection runs every 6 hours. A full sync runs one time each
              day. Pages read from the saved snapshots, not from live calls. Each
              page shows the time of the last collection where it applies.
            </p>
            <p>
              Change detection runs on every cycle. It finds TVL moves, APY
              shifts, fee changes, allocation changes, and liquidations.
            </p>
            <p>
              CuratorWatch does not count the same vault two times. It uses the
              on-chain address to remove duplicates across the sources.
            </p>
          </DocSection>

          <DocSection id="assets" title="Blue-chip assets">
            <p>The calculator recognizes these assets as blue-chip:</p>
            <div className="flex flex-wrap gap-1.5">
              {BLUE_CHIP.map((symbol) => (
                <span
                  key={symbol}
                  className="px-2 py-0.5 text-xs font-medium rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                >
                  {symbol}
                </span>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              The codebase holds the full list. The team updates the list as the
              ecosystem changes. The list above does not show every wrapped,
              staked, and vault token.
            </p>
          </DocSection>

          <DocSection id="glossary" title="Glossary">
            <dl className="divide-y divide-border-subtle border border-border rounded-xl overflow-hidden">
              {GLOSSARY.map((g) => (
                <div key={g.term} className="grid sm:grid-cols-[180px_1fr] gap-x-4 gap-y-1 px-4 py-3 bg-background-subtle">
                  <dt className="font-mono text-sm font-semibold text-text-primary">{g.term}</dt>
                  <dd className="text-sm text-text-secondary">{g.def}</dd>
                </div>
              ))}
            </dl>
          </DocSection>

          <DocSection id="disclaimer" title="Disclaimer">
            <div className="rounded-xl border border-accent-yellow/30 bg-accent-yellow/5 p-5 space-y-2">
              <p>CuratorWatch gives information only. It is not financial advice.</p>
              <p>
                The figures come from public on-chain data. They do not guarantee
                safety, returns, or solvency.
              </p>
              <p>Do your own research before you allocate money.</p>
            </div>
          </DocSection>
        </article>
      </div>
    </>
  );
}

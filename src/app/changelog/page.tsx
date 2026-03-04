import { PageHeader } from "@/components/layout/PageHeader";

type Category = "Feature" | "Fix" | "Improvement";

interface ChangelogItem {
  category: Category;
  text: string;
}

interface ChangelogEntry {
  date: string;
  items: ChangelogItem[];
}

const categoryStyles: Record<Category, string> = {
  Feature: "bg-accent-blue/20 text-accent-blue",
  Fix: "bg-accent-red/20 text-accent-red",
  Improvement: "bg-accent-yellow/20 text-accent-yellow",
};

const entries: ChangelogEntry[] = [
  {
    date: "March 3, 2026",
    items: [
      {
        category: "Feature",
        text: "Name-based curator URLs \u2014 curator pages now use human-readable slugs (e.g. /curator/steakhouse, /curator/re7-labs) instead of raw hex addresses. All links across the homepage grid, search dropdown, Top Curators, vault breadcrumbs, and curator sections use slug URLs. Old 0x-prefixed URLs remain backwards compatible.",
      },
      {
        category: "Feature",
        text: "Replaced composite letter-grade rating with Risk Profile tab on curator detail pages \u2014 shows 7 individual risk factors (bad debt, time in operation, collateral quality, governance, scale, vault count, team transparency) as cards with peer-relative color scales. No composite score or letter grade; just the data with context.",
      },
      {
        category: "Improvement",
        text: "Removed Grade column from homepage curator grid and rating badges from Top Curators widget \u2014 composite ratings had data quality issues with hardcoded/disabled factors. Risk data is now available on the dedicated Risk Profile tab per curator.",
      },
    ],
  },
  {
    date: "March 2, 2026",
    items: [
      {
        category: "Feature",
        text: "Deposit CTA parity \u2014 Turtle vaults now show a \"View on Turtle\" button on vault detail pages and the Top Vaults widget, matching the existing \"View on Morpho\" flow for Morpho vaults",
      },
      {
        category: "Feature",
        text: "Added homepage announcement banner highlighting cross-protocol vault coverage powered by Turtle. Dismissible and persists across page loads",
      },
      {
        category: "Fix",
        text: "Fixed protocol fee calculations \u2014 Morpho's 15% protocol fee was incorrectly applied to all vaults including non-Morpho (Aave, Euler, Compound) vaults. Protocol fees are now only calculated for Morpho vaults where the fee structure is known.",
      },
      {
        category: "Improvement",
        text: "Renamed \"Morpho Fees\" to \"Protocol Fees\" across the homepage, fees page, fee grids, and vault detail cards to accurately reflect multi-protocol coverage. Vault-level fee analysis now hides the protocol fee section for non-Morpho vaults.",
      },
      {
        category: "Improvement",
        text: "\"View on Turtle\" now deep-links to the specific opportunity page on Turtle instead of the homepage",
      },
      {
        category: "Improvement",
        text: "Vaults page now shows curator name instead of truncated address in the Curator column",
      },
      {
        category: "Improvement",
        text: "Vault detail header now displays \"Curated by\" with the curator's name for clear attribution",
      },
      {
        category: "Improvement",
        text: "Removed Vault Configuration section, Risk grade column, and Risk Profile tab \u2014 streamlined UI to focus on actionable data",
      },
      {
        category: "Fix",
        text: "Fixed APR vs APY mismatch \u2014 Turtle API reports APR while Morpho reports APY. CuratorWatch now converts APR to APY using daily compounding at ingestion for consistent cross-protocol comparison",
      },
      {
        category: "Improvement",
        text: "Updated homepage banner with live stats: 50+ vaults, $780M+ TVL, 14 curators across 10+ protocols",
      },
    ],
  },
  {
    date: "February 26, 2026",
    items: [
      {
        category: "Feature",
        text: "Multi-protocol expansion \u2014 CuratorWatch now tracks managed vaults across Aave, Euler, Compound, Spark, and other protocols via the Turtle API. Cross-protocol data updates every 4 hours.",
      },
      {
        category: "Feature",
        text: "Added protocol badges throughout the UI \u2014 curators and vaults now show which protocols they operate on",
      },
      {
        category: "Improvement",
        text: "Updated branding from \"Morpho V2 Vault Analytics\" to \"Multi-Protocol Vault Analytics\" to reflect broader coverage",
      },
      {
        category: "Feature",
        text: "Upgraded to hourly data collection \u2014 all vault data (TVL, APY, risk scores, adapter allocations) and alert detection now runs every hour instead of once daily",
      },
      {
        category: "Feature",
        text: "Full data collection (transactions, reallocations, market allocations, liquidations) continues to run daily at midnight UTC",
      },
      {
        category: "Improvement",
        text: "Upgraded to Vercel Pro for faster serverless execution (up to 800s function duration) and reliable hourly cron scheduling",
      },
    ],
  },
  {
    date: "February 24, 2026",
    items: [
      {
        category: "Feature",
        text: "Added Liquidations tab to Economics page \u2014 shows total liquidation events, collateral seized, and bad debt with per-curator breakdown and expandable recent events",
      },
      {
        category: "Feature",
        text: "Added Fees tab to yields page \u2014 shows total annual fees, average fee rate, and per-curator revenue breakdown with expandable asset-level detail",
      },
      {
        category: "Feature",
        text: "Added Economics tab to curator detail pages \u2014 replaces Performance and Activity tabs with annual yield, annual fees, net to LPs, vault economics table, and asset breakdown",
      },
      {
        category: "Fix",
        text: "Fixed Clearstar and Re Ecosystem vaults showing under Re7 Labs \u2014 added vault-level curator overrides so the daily cron no longer reassigns split curators back to the shared on-chain address",
      },
      {
        category: "Improvement",
        text: "Renamed Alpha Finance to AlphaPing with correct profile data (Swiss corporation, alphaping.ch)",
      },
      {
        category: "Improvement",
        text: "Removed 30D Change column from homepage curator table",
      },
    ],
  },
  {
    date: "February 23, 2026",
    items: [
      {
        category: "Feature",
        text: "Split Clearstar out as its own curator \u2014 Clearstar\u2019s 4 vaults ($15.7M) were previously grouped under Re7 Labs because they share an on-chain curator address",
      },
      {
        category: "Feature",
        text: "Split Re Ecosystem out as its own curator from Re7 Labs \u2014 Re Ecosystem Vault USDC was incorrectly grouped under Re7 Labs",
      },
      {
        category: "Feature",
        text: "Split Kabu out as its own curator from API3 \u2014 Kabu USDC was incorrectly grouped under API3",
      },
      {
        category: "Fix",
        text: "Fixed curator search bar \u2014 eliminated full skeleton flash on every keystroke, made address search case-insensitive, and trimmed whitespace from search input",
      },
      {
        category: "Improvement",
        text: "Alerts and data collection run on schedule via Vercel Cron (now hourly, originally daily)",
      },
      {
        category: "Improvement",
        text: "Updated Clearstar profile to Clearstar Labs AG with correct jurisdiction (Switzerland) based on direct feedback from the team",
      },
      {
        category: "Improvement",
        text: "Curator detail pages now use clean URL slugs instead of raw addresses for split curators (e.g. /curator/clearstar instead of /curator/override-clearstar)",
      },
      {
        category: "Fix",
        text: "Fixed crash caused by non-hex curator addresses in avatar and color generation functions \u2014 hardened all 7 affected components to handle any string safely",
      },
      {
        category: "Improvement",
        text: "Redesigned yields page \u2014 curator tab now has expandable rows showing vault breakdowns grouped by asset with gross APY \u2192 net APY and fee transparency. Vault tab adds gross APY and fee columns",
      },
    ],
  },
  {
    date: "February 22, 2026",
    items: [
      {
        category: "Fix",
        text: "Fixed AUM chart showing an 18% drop caused by a partial data collection \u2014 a database connection failure resulted in only 4 of 75 vaults being snapshotted, skewing the daily aggregate",
      },
      {
        category: "Improvement",
        text: "Removed misleading curator-level APY \u2014 averaging APY across different asset types and risk profiles was meaningless. APY is now only shown at the vault level where it\u2019s accurate",
      },
      {
        category: "Improvement",
        text: "Vaults on curator detail pages are now grouped by asset type (USDC, WETH, etc.) so each vault\u2019s APY is shown in proper context",
      },
      {
        category: "Feature",
        text: "Added changelog page accessible from the top navigation bar",
      },
      {
        category: "Fix",
        text: 'Corrected fee calculations \u2014 Morpho and curator fee estimates were displaying significantly lower than actual values',
      },
      {
        category: "Improvement",
        text: 'Removed "Avg" prefix from APY labels across all pages for cleaner presentation',
      },
      {
        category: "Improvement",
        text: "Removed APY stat card from homepage",
      },
    ],
  },
  {
    date: "February 21, 2026",
    items: [
      {
        category: "Feature",
        text: "Redesigned alert system \u2014 deposits now show as positive (green) events, withdrawals as warnings (red/orange)",
      },
      {
        category: "Fix",
        text: "Enabled full data collection on daily cron to ensure transaction-based alerts fire correctly",
      },
    ],
  },
  {
    date: "February 20, 2026",
    items: [
      {
        category: "Feature",
        text: "Consolidated multi-address curators \u2014 curators using multiple on-chain addresses (KPK, Gauntlet, Morpho Association) now appear as a single entity with combined AUM and vault counts",
      },
      {
        category: "Feature",
        text: "Added fees analysis, yields dashboard, share page, curator ratings, and strategy intelligence",
      },
      {
        category: "Improvement",
        text: "Added X/Twitter link in footer",
      },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <PageHeader
        title="Changelog"
        description="Recent updates and improvements to CuratorWatch"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Changelog" }]}
      />
      <div className="space-y-10 max-w-[800px]">
        {entries.map((entry) => (
          <section key={entry.date}>
            <h2 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">
              {entry.date}
            </h2>
            <div className="space-y-3">
              {entry.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-background-subtle border border-border"
                >
                  <span
                    className={`flex-shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded ${categoryStyles[item.category]}`}
                  >
                    {item.category}
                  </span>
                  <p className="text-sm text-text-primary leading-relaxed">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

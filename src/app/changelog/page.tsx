import Link from "next/link";
import Image from "next/image";

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
    date: "February 24, 2026",
    items: [
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
        text: "Alerts and data collection run on a daily schedule via Vercel Cron",
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
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-[800px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-1">Changelog</h1>
          <p className="text-sm text-text-secondary">
            Recent updates and improvements to CuratorWatch
          </p>
        </div>

        <div className="space-y-10">
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
      </main>

      <footer className="border-t border-border bg-background-subtle mt-auto">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <p>
              Data from{" "}
              <a
                href="https://api.morpho.org/graphql"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-blue hover:text-accent-blue-hover"
              >
                Morpho API
              </a>
              {" "}&bull; Updated hourly
            </p>
            <div className="flex items-center gap-3">
              <Link href="/changelog" className="text-text-tertiary hover:text-text-primary transition-colors">
                Changelog
              </Link>
              <a
                href="https://x.com/curator_watch"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-tertiary hover:text-text-primary transition-colors"
                title="Follow us on X"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                Live
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="bg-background-subtle border-b border-border sticky top-0 z-50">
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="CuratorWatch" width={32} height={32} className="rounded-lg" />
            <div>
              <h1 className="text-lg font-bold text-text-primary tracking-tight leading-tight">
                CuratorWatch
              </h1>
              <p className="text-[10px] text-text-tertiary leading-tight">
                Morpho V2 Vault Analytics
              </p>
            </div>
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/vaults"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Vaults
            </Link>
            <Link href="/changelog" className="text-sm font-medium text-accent-blue">
              Changelog
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

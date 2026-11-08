"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";

interface CuratorData {
  name: string;
  totalAUM: number;
  vaultCount: number;
  avgNetApy: number;
}

interface StatsData {
  totalAUM: number;
  totalVaults: number;
  totalCurators: number;
  avgApy: number;
}

export default function SharePage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [topCurators, setTopCurators] = useState<CuratorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/curators?pageSize=8&sortBy=aum&sortOrder=desc");
        const data = await response.json();
        if (data.success) {
          setStats(data.data.stats);
          setTopCurators(data.data.curators);
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20 label">Loading…</div>;
  }

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return (
    <>
      <PageHeader
        title="Social Share Cards"
        description="Screenshot these cards for X and LinkedIn posts"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Share" }]}
      />
      <div className="grid gap-6">
          {/* Card 1: Hero Stats Card (1200x675 - Twitter/X optimal) */}
          <CardSlot label="Card 1: Hero Stats (X Header)" size="1200×675">
            <div className="w-[1200px] h-[675px] bg-background border border-border-strong flex flex-col">
              <CardBar right={<><span className="label mr-3">Live data</span><span className="num text-text-primary">{today}</span></>} />

              <div className="flex-1 flex flex-col justify-between px-12 py-10">
                <div>
                  <h1 className="cond text-6xl font-bold text-text-primary leading-none">CuratorWatch</h1>
                  <p className="text-2xl text-text-secondary mt-3">Morpho Midnight Vault Analytics</p>
                </div>

                {/* Main Stats */}
                <dl className="grid grid-cols-4 border border-border bg-background-subtle">
                  <StatBox
                    label="Total Value Locked"
                    value={formatCurrency(stats?.totalAUM || 0)}
                    highlight
                  />
                  <StatBox
                    label="Active Vaults"
                    value={stats?.totalVaults?.toString() || "0"}
                  />
                  <StatBox
                    label="Curators"
                    value={stats?.totalCurators?.toString() || "0"}
                  />
                  <StatBox
                    label="Net APY"
                    value={formatPercentage(stats?.avgApy || 0)}
                  />
                </dl>
              </div>

              <CardFoot left="curatorwatch.com" right="@curator_watch" />
            </div>
          </CardSlot>

          {/* Card 2: Top Curators Leaderboard */}
          <CardSlot label="Card 2: Curator Leaderboard" size="1200×675">
            <div className="w-[1200px] h-[675px] bg-background border border-border-strong flex flex-col">
              <CardBar right={<span className="num text-text-primary">{today}</span>} />

              <div className="flex-1 flex flex-col px-12 py-8 min-h-0">
                <div className="mb-6">
                  <h1 className="cond text-5xl font-bold text-text-primary leading-none">Top Curators by AUM</h1>
                  <p className="text-xl text-text-secondary mt-2">Morpho Midnight Ethereum Mainnet</p>
                </div>

                {/* Leaderboard */}
                <div className="flex-1 grid grid-cols-2 grid-rows-4 border border-border bg-background-subtle">
                  {topCurators.slice(0, 8).map((curator, index) => (
                    <div
                      key={curator.name}
                      className={`flex items-center gap-5 px-6 border-border-subtle ${
                        index % 2 === 0 ? "border-r" : ""
                      } ${index < 6 ? "border-b" : ""}`}
                    >
                      <span className={`num text-2xl font-semibold w-10 ${index < 3 ? "text-accent-blue" : "text-text-muted"}`}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xl text-text-primary font-semibold truncate">{curator.name}</p>
                        <p className="label text-sm mt-1">{curator.vaultCount} vault{curator.vaultCount !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="num text-xl text-text-primary font-semibold">{formatCurrency(curator.totalAUM)}</p>
                        <p className="num text-sm text-text-secondary mt-1">{formatPercentage(curator.avgNetApy)} APY</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <CardFoot left={today} right="curatorwatch.com · @curator_watch" />
            </div>
          </CardSlot>

          {/* Card 3: Single Stat Highlight (Square for Instagram/LinkedIn) */}
          <CardSlot label="Card 3: AUM Highlight (Square)" size="1080×1080">
            <div className="w-[1080px] h-[1080px] bg-background border border-border-strong flex flex-col">
              <CardBar right={<span className="label text-base">Morpho Midnight Analytics</span>} />

              {/* Main Number */}
              <div className="flex-1 flex flex-col items-center justify-center text-center px-16">
                <p className="label text-3xl tracking-[0.12em]">Total Value Locked</p>
                <p className="num text-[9rem] font-semibold leading-none text-accent-blue mt-8">
                  {formatCurrency(stats?.totalAUM || 0)}
                </p>
                <div className="w-full max-w-2xl border-t border-border mt-10 pt-6">
                  <p className="text-2xl text-text-secondary">
                    across <span className="num text-text-primary">{stats?.totalVaults}</span> vaults from{" "}
                    <span className="num text-text-primary">{stats?.totalCurators}</span> curators
                  </p>
                </div>
              </div>

              <CardFoot left={today} right="curatorwatch.com" large />
            </div>
          </CardSlot>

          {/* Card 4: Weekly Alpha Format */}
          <CardSlot label="Card 4: Weekly Alpha Thread Header" size="1200×675">
            <div className="w-[1200px] h-[675px] bg-background border border-border-strong flex flex-col">
              <CardBar right={<span className="num text-text-primary">{today}</span>} />

              <div className="flex-1 flex flex-col justify-between px-12 py-10">
                <div>
                  <span className="fn-tag text-base px-3 py-2">Weekly Morpho Alpha</span>
                  <h1 className="cond text-7xl font-bold text-text-primary leading-[0.95] mt-6 mb-5">
                    This Week in<br />Morpho Midnight Vaults
                  </h1>
                  <p className="text-text-secondary text-2xl max-w-2xl">
                    Curator movements, yield changes, and risk alerts you need to know.
                  </p>
                </div>

                {/* Stats preview */}
                <dl className="grid grid-cols-3 max-w-3xl border border-border bg-background-subtle">
                  <StatBox label="Total AUM" value={formatCurrency(stats?.totalAUM || 0)} compact />
                  <StatBox label="APY" value={formatPercentage(stats?.avgApy || 0)} compact />
                  <StatBox label="Active Vaults" value={String(stats?.totalVaults ?? "")} compact />
                </dl>
              </div>

              <CardFoot left="curatorwatch.com" right="@curator_watch" />
            </div>
          </CardSlot>

          {/* Card 5: Coming Soon Features */}
          <CardSlot label="Card 5: Coming Soon / Roadmap" size="1200×675">
            <div className="w-[1200px] h-[675px] bg-background border border-border-strong flex flex-col">
              <CardBar right={<span className="label text-base">CuratorWatch Roadmap</span>} />

              <div className="flex-1 flex flex-col justify-between px-12 py-10">
                <h1 className="cond text-6xl font-bold text-text-primary leading-none">What&apos;s Next</h1>

                {/* Features Grid */}
                <div className="grid grid-cols-2 border border-border bg-background-subtle">
                  <FeatureCard
                    code="01"
                    title="Smart Contract Risk"
                    description="Audit status, code complexity, and exploit history for every vault"
                    className="border-r border-b"
                  />
                  <FeatureCard
                    code="02"
                    title="Redemption Risk"
                    description="Liquidity depth analysis and withdrawal simulation"
                    className="border-b"
                  />
                  <FeatureCard
                    code="03"
                    title="Composability Maps"
                    description="Visualize protocol dependencies and contagion risk"
                    className="border-r"
                  />
                  <FeatureCard
                    code="04"
                    title="RWA Yield Impact"
                    description="Track how real-world assets are reshaping DeFi yields"
                  />
                </div>
              </div>

              <CardFoot
                left={<span className="text-accent-blue">Building the intelligence layer for DeFi</span>}
                right="curatorwatch.com"
              />
            </div>
          </CardSlot>

      </div>
      {/* Instructions */}
      <Panel title="How to use these cards" className="mt-6" bodyClassName="p-3">
        <ol className="text-sm text-text-secondary space-y-1.5">
          <li><span className="num text-text-tertiary mr-2">1.</span>Right-click on any card and select &quot;Take Screenshot&quot; (or use your OS screenshot tool)</li>
          <li><span className="num text-text-tertiary mr-2">2.</span>Crop to the card boundaries</li>
          <li><span className="num text-text-tertiary mr-2">3.</span>Post directly to X or LinkedIn</li>
          <li><span className="num text-text-tertiary mr-2">4.</span>Cards are optimized: <span className="num">1200x675</span> for X, <span className="num">1080x1080</span> for Instagram/LinkedIn square</li>
        </ol>
      </Panel>
    </>
  );
}

// A card with its caption. The card keeps its fixed export size; the slot
// scrolls sideways on narrow screens so the page itself never overflows.
function CardSlot({ label, size, children }: { label: string; size: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h2 className="label mb-1.5">
        {label} <span className="num text-text-muted normal-case ml-1">{size}</span>
      </h2>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

// Card title bar: logo + wordmark (as in the app header), context on the right.
function CardBar({ right }: { right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 h-20 px-12 bg-background-elevated border-b border-border-strong flex-none">
      <Image src="/logo.png" alt="" width={36} height={36} className="flex-none" />
      <span className="cond text-3xl font-extrabold uppercase tracking-[0.06em] text-text-primary">
        Curator<span className="text-accent-blue">Watch</span>
      </span>
      <span className="ml-auto flex items-center text-lg">{right}</span>
    </div>
  );
}

function CardFoot({ left, right, large = false }: { left: React.ReactNode; right: React.ReactNode; large?: boolean }) {
  return (
    <div className={`flex items-center justify-between h-14 px-12 border-t border-border flex-none ${large ? "text-xl" : "text-lg"}`}>
      <span className="text-text-tertiary">{left}</span>
      <span className="text-text-tertiary">{right}</span>
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight,
  compact = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`border-r border-border last:border-r-0 ${compact ? "px-6 py-4" : "px-7 py-6"}`}>
      <dt className="label text-base">{label}</dt>
      <dd className={`num font-semibold leading-none mt-3 ${compact ? "text-3xl" : "text-5xl"} ${highlight ? "text-accent-blue" : "text-text-primary"}`}>
        {value}
      </dd>
    </div>
  );
}

function FeatureCard({
  code,
  title,
  description,
  className = "",
}: {
  code: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={`flex gap-5 p-7 border-border ${className}`}>
      <span className="num text-2xl font-semibold text-accent-blue">{code}</span>
      <div>
        <h3 className="cond text-2xl font-bold uppercase tracking-[0.03em] text-text-primary mb-2">{title}</h3>
        <p className="text-lg text-text-secondary">{description}</p>
      </div>
    </div>
  );
}

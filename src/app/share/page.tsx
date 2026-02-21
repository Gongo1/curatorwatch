"use client";

import { useState, useEffect } from "react";
import { formatCurrency, formatPercentage } from "@/lib/utils/format";

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
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  return (
    <div className="min-h-screen bg-neutral-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Social Share Cards</h1>
        <p className="text-neutral-400 mb-8">Screenshot these cards for X and LinkedIn posts</p>

        <div className="grid gap-8">
          {/* Card 1: Hero Stats Card (1200x675 - Twitter/X optimal) */}
          <div>
            <h2 className="text-sm font-medium text-neutral-500 mb-3 uppercase tracking-wider">
              Card 1: Hero Stats (X Header)
            </h2>
            <div
              className="w-[1200px] h-[675px] bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 rounded-3xl p-12 flex flex-col justify-between relative overflow-hidden"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />

              {/* Header */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">C</span>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-white">CuratorWatch</h1>
                    <p className="text-neutral-400 text-lg">Morpho V2 Vault Analytics</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-neutral-500 text-sm">Live Data</p>
                  <p className="text-white font-medium">{today}</p>
                </div>
              </div>

              {/* Main Stats */}
              <div className="grid grid-cols-4 gap-8 relative z-10">
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
                  label="Avg Net APY"
                  value={formatPercentage(stats?.avgApy || 0)}
                  valueColor="text-emerald-400"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between relative z-10">
                <p className="text-neutral-500">curatorwatch.com</p>
                <p className="text-neutral-500">@curator_watch</p>
              </div>
            </div>
          </div>

          {/* Card 2: Top Curators Leaderboard */}
          <div>
            <h2 className="text-sm font-medium text-neutral-500 mb-3 uppercase tracking-wider">
              Card 2: Curator Leaderboard
            </h2>
            <div
              className="w-[1200px] h-[675px] bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 rounded-3xl p-12 flex flex-col relative overflow-hidden"
            >
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">Top Curators by AUM</h1>
                  <p className="text-neutral-400">Morpho V2 Ethereum Mainnet</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                    <span className="text-white font-bold">C</span>
                  </div>
                  <span className="text-white font-semibold">CuratorWatch</span>
                </div>
              </div>

              {/* Leaderboard */}
              <div className="flex-1 grid grid-cols-2 gap-4">
                {topCurators.slice(0, 8).map((curator, index) => (
                  <div
                    key={curator.name}
                    className={`flex items-center gap-4 p-4 rounded-xl ${
                      index < 3 ? "bg-blue-500/10 border border-blue-500/20" : "bg-white/5"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      index === 0 ? "bg-yellow-500 text-black" :
                      index === 1 ? "bg-neutral-300 text-black" :
                      index === 2 ? "bg-amber-700 text-white" :
                      "bg-neutral-700 text-white"
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{curator.name}</p>
                      <p className="text-neutral-400 text-sm">{curator.vaultCount} vault{curator.vaultCount !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{formatCurrency(curator.totalAUM)}</p>
                      <p className="text-emerald-400 text-sm">{formatPercentage(curator.avgNetApy)} APY</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
                <p className="text-neutral-500">{today}</p>
                <p className="text-neutral-500">curatorwatch.com • @curator_watch</p>
              </div>
            </div>
          </div>

          {/* Card 3: Single Stat Highlight (Square for Instagram/LinkedIn) */}
          <div>
            <h2 className="text-sm font-medium text-neutral-500 mb-3 uppercase tracking-wider">
              Card 3: AUM Highlight (Square)
            </h2>
            <div
              className="w-[1080px] h-[1080px] bg-gradient-to-br from-neutral-950 via-blue-950/30 to-neutral-950 rounded-3xl p-16 flex flex-col justify-between relative overflow-hidden"
            >
              {/* Background decoration */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-3xl" />

              {/* Logo */}
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center">
                  <span className="text-white font-bold text-3xl">C</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">CuratorWatch</h1>
                  <p className="text-neutral-400">Morpho V2 Analytics</p>
                </div>
              </div>

              {/* Main Number */}
              <div className="text-center relative z-10">
                <p className="text-neutral-400 text-2xl mb-4 uppercase tracking-widest">Total Value Locked</p>
                <p className="text-8xl font-bold text-white mb-4">{formatCurrency(stats?.totalAUM || 0)}</p>
                <p className="text-neutral-400 text-xl">across {stats?.totalVaults} vaults from {stats?.totalCurators} curators</p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between relative z-10">
                <p className="text-neutral-500 text-lg">{today}</p>
                <p className="text-neutral-500 text-lg">curatorwatch.com</p>
              </div>
            </div>
          </div>

          {/* Card 4: Weekly Alpha Format */}
          <div>
            <h2 className="text-sm font-medium text-neutral-500 mb-3 uppercase tracking-wider">
              Card 4: Weekly Alpha Thread Header
            </h2>
            <div
              className="w-[1200px] h-[675px] bg-gradient-to-br from-neutral-950 to-blue-950/50 rounded-3xl p-12 flex flex-col justify-between relative overflow-hidden"
            >
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-20 left-20 w-40 h-40 border border-blue-500/30 rounded-full" />
                <div className="absolute top-32 left-32 w-40 h-40 border border-blue-500/20 rounded-full" />
                <div className="absolute bottom-20 right-20 w-60 h-60 border border-purple-500/30 rounded-full" />
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="inline-block px-4 py-2 bg-blue-500/20 rounded-full border border-blue-500/30 mb-6">
                  <span className="text-blue-400 font-medium">Weekly Morpho Alpha</span>
                </div>
                <h1 className="text-5xl font-bold text-white leading-tight mb-4">
                  This Week in<br />Morpho V2 Vaults
                </h1>
                <p className="text-neutral-400 text-xl max-w-xl">
                  Curator movements, yield changes, and risk alerts you need to know.
                </p>
              </div>

              {/* Stats preview */}
              <div className="flex gap-8 relative z-10">
                <div className="px-6 py-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-neutral-400 text-sm mb-1">Total AUM</p>
                  <p className="text-white text-2xl font-bold">{formatCurrency(stats?.totalAUM || 0)}</p>
                </div>
                <div className="px-6 py-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-neutral-400 text-sm mb-1">Avg APY</p>
                  <p className="text-emerald-400 text-2xl font-bold">{formatPercentage(stats?.avgApy || 0)}</p>
                </div>
                <div className="px-6 py-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-neutral-400 text-sm mb-1">Active Vaults</p>
                  <p className="text-white text-2xl font-bold">{stats?.totalVaults}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                    <span className="text-white font-bold">C</span>
                  </div>
                  <span className="text-white font-semibold">CuratorWatch</span>
                </div>
                <p className="text-neutral-500">@curator_watch</p>
              </div>
            </div>
          </div>

          {/* Card 5: Coming Soon Features */}
          <div>
            <h2 className="text-sm font-medium text-neutral-500 mb-3 uppercase tracking-wider">
              Card 5: Coming Soon / Roadmap
            </h2>
            <div
              className="w-[1200px] h-[675px] bg-gradient-to-br from-purple-950/50 via-neutral-950 to-neutral-950 rounded-3xl p-12 flex flex-col justify-between relative overflow-hidden"
            >
              {/* Background decoration */}
              <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />

              {/* Header */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">C</span>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-white">What's Next</h1>
                    <p className="text-neutral-400">CuratorWatch Roadmap</p>
                  </div>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 gap-6 relative z-10">
                <FeatureCard
                  icon="🔒"
                  title="Smart Contract Risk"
                  description="Audit status, code complexity, and exploit history for every vault"
                />
                <FeatureCard
                  icon="💧"
                  title="Redemption Risk"
                  description="Liquidity depth analysis and withdrawal simulation"
                />
                <FeatureCard
                  icon="🔗"
                  title="Composability Maps"
                  description="Visualize protocol dependencies and contagion risk"
                />
                <FeatureCard
                  icon="🏛️"
                  title="RWA Yield Impact"
                  description="Track how real-world assets are reshaping DeFi yields"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between relative z-10">
                <p className="text-purple-400 font-medium">Building the intelligence layer for DeFi</p>
                <p className="text-neutral-500">curatorwatch.com</p>
              </div>
            </div>
          </div>

        </div>

        {/* Instructions */}
        <div className="mt-12 p-6 bg-neutral-800 rounded-xl">
          <h2 className="text-lg font-semibold text-white mb-3">How to Use These Cards</h2>
          <ol className="text-neutral-300 space-y-2">
            <li>1. Right-click on any card and select "Take Screenshot" (or use your OS screenshot tool)</li>
            <li>2. Crop to the card boundaries</li>
            <li>3. Post directly to X or LinkedIn</li>
            <li>4. Cards are optimized: 1200x675 for X, 1080x1080 for Instagram/LinkedIn square</li>
          </ol>
        </div>
      </div>

      <footer className="border-t border-neutral-700 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <p>
              Data from{" "}
              <a href="https://api.morpho.org/graphql" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Morpho API</a>
              {" "}• Updated hourly
            </p>
            <div className="flex items-center gap-3">
              <a href="https://x.com/curator_watch" target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white transition-colors" title="Follow us on X">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Live
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight,
  valueColor
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueColor?: string;
}) {
  return (
    <div className={`p-6 rounded-2xl ${highlight ? "bg-blue-500/20 border border-blue-500/30" : "bg-white/5"}`}>
      <p className="text-neutral-400 text-sm mb-2 uppercase tracking-wider">{label}</p>
      <p className={`text-4xl font-bold ${valueColor || "text-white"}`}>{value}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
      <span className="text-4xl mb-4 block">{icon}</span>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-neutral-400">{description}</p>
    </div>
  );
}

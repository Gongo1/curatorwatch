"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  formatCurrency,
  formatPercentage,
  formatAddress,
  formatTimeAgo,
} from "@/lib/utils/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Tabs";
import { CuratorDepositors } from "@/components/CuratorDepositors";
import { CuratorAvatar, CuratorAvatarFallback } from "@/components/CuratorAvatar";
import { CopyAddress } from "@/components/CopyAddress";
import type { CuratorDetailResponse } from "@/lib/types/api";

interface PageProps {
  params: Promise<{ address: string }>;
}

// Generate a deterministic color from an address for vault icons
function getVaultColor(address: string): string {
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-rose-500",
  ];
  const index = parseInt(address.slice(2, 4), 16) % colors.length;
  return colors[index];
}

export default function CuratorDetailPage({ params }: PageProps) {
  const { address } = use(params);
  const [data, setData] = useState<CuratorDetailResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCurator() {
      try {
        const response = await fetch(`/api/curators/${address}`);
        const result: CuratorDetailResponse = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Curator not found");
        }

        setData(result.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load curator");
      } finally {
        setLoading(false);
      }
    }

    fetchCurator();
  }, [address]);

  if (loading) {
    return <CuratorDetailSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-text-tertiary hover:text-text-primary transition-colors mb-6"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Curators
          </Link>

          <div className="bg-background-subtle rounded-lg border border-accent-red/30 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-accent-red/15 flex items-center justify-center mx-auto">
              <svg className="h-8 w-8 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-medium text-text-primary">Curator Not Found</h2>
            <p className="mt-2 text-sm text-text-secondary">{error || "The curator you're looking for doesn't exist."}</p>
            <p className="mt-1 text-xs text-text-muted font-mono">{address}</p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary bg-background-elevated hover:bg-background-hover transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { curator, vaults, news } = data;

  // Calculate aggregate stats
  const totalTVL = vaults.reduce((sum, v) => sum + (v.latestSnapshot?.totalAssetsUsd ?? 0), 0);
  const weightedApySum = vaults.reduce((sum, v) => {
    const tvl = v.latestSnapshot?.totalAssetsUsd ?? 0;
    const apy = v.latestSnapshot?.avgNetApy ?? 0;
    return sum + (apy * tvl);
  }, 0);
  const avgApy = totalTVL > 0 ? weightedApySum / totalTVL : 0;

  // Asset distribution
  const assetMap: Record<string, number> = {};
  vaults.forEach(v => {
    const tvl = v.latestSnapshot?.totalAssetsUsd ?? 0;
    assetMap[v.asset.symbol] = (assetMap[v.asset.symbol] || 0) + tvl;
  });
  const assetDistribution = Object.entries(assetMap)
    .map(([symbol, amount]) => ({
      symbol,
      amount,
      percentage: totalTVL > 0 ? (amount / totalTVL) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background-subtle border-b border-border sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-6 mb-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-sm font-bold text-text-primary hidden sm:inline">CuratorWatch</span>
            </Link>
            <nav className="flex items-center gap-4 ml-auto">
              <Link href="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                Curators
              </Link>
              <Link href="/vaults" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                All Vaults
              </Link>
              <Link href="/alerts" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                Alerts
              </Link>
            </nav>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <CuratorAvatar
                address={curator.address}
                name={curator.name}
                logoUrl={curator.logoUrl}
                size="lg"
              />
              <div>
                <h1 className="text-xl font-semibold text-text-primary tracking-tight">
                  {curator.name && curator.name !== "Unknown" ? curator.name : `Curator ${formatAddress(curator.address)}`}
                </h1>
                <p className="text-sm text-text-tertiary">
                  Managing {formatCurrency(totalTVL)} across {vaults.length} vault{vaults.length !== 1 ? "s" : ""}
                </p>
                <div className="mt-0.5">
                  <CopyAddress address={curator.address} />
                </div>
              </div>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-2">
              {curator.website && (
                <a
                  href={curator.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-background-elevated hover:bg-background-hover border border-border transition-colors text-sm"
                >
                  <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <span className="text-text-secondary">Website</span>
                </a>
              )}
              {curator.twitter && (
                <a
                  href={curator.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-background-elevated hover:bg-background-hover border border-border transition-colors"
                  title="Twitter/X"
                >
                  <svg className="w-4 h-4 text-text-tertiary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              )}
              {curator.discord && (
                <a
                  href={curator.discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-background-elevated hover:bg-background-hover border border-border transition-colors"
                  title="Discord"
                >
                  <svg className="w-4 h-4 text-text-tertiary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <StatCard
            label="Total AUM"
            value={formatCurrency(totalTVL)}
            highlight
          />
          <StatCard
            label="Vaults"
            value={vaults.length.toString()}
          />
          <StatCard
            label="Avg APY"
            value={formatPercentage(avgApy)}
            valueClass="text-accent-green"
          />
          <StatCard
            label="Strategy"
            value="Moderate"
            valueClass="text-purple-400"
          />
          <StatCard
            label="Founded"
            value={curator.foundedYear?.toString() || "-"}
          />
          <StatCard
            label="Team Size"
            value={curator.teamSize || "-"}
          />
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="overview">
          <TabsList className="rounded-t-lg">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="vaults">Vaults</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="risk">Risk Profile</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-1 space-y-6">
                {/* About */}
                {curator.description && (
                  <section className="bg-background-subtle rounded-lg border border-border p-6">
                    <h2 className="text-sm font-semibold text-text-primary mb-3">About</h2>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {curator.description}
                    </p>
                  </section>
                )}

                {/* Regulatory & Compliance */}
                <section className="bg-background-subtle rounded-lg border border-border p-6">
                  <h2 className="text-sm font-semibold text-text-primary mb-4">
                    Regulatory & Compliance
                  </h2>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <dt className="text-text-tertiary">Regulated Entity</dt>
                      <dd className={`font-medium ${curator.isRegulated ? "text-accent-green" : "text-text-muted"}`}>
                        {curator.isRegulated ? (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            Yes
                          </span>
                        ) : "No"}
                      </dd>
                    </div>
                    {curator.regulatoryBody && (
                      <div className="flex justify-between">
                        <dt className="text-text-tertiary">Regulatory Body</dt>
                        <dd className="font-medium text-text-primary">{curator.regulatoryBody}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-text-tertiary">Jurisdiction</dt>
                      <dd className="font-medium text-text-primary">{curator.jurisdiction || "-"}</dd>
                    </div>
                    {curator.entityType && (
                      <div className="flex justify-between">
                        <dt className="text-text-tertiary">Entity Type</dt>
                        <dd className="font-medium text-text-primary">
                          {curator.entityType}
                          {curator.registeredState && ` (${curator.registeredState})`}
                        </dd>
                      </div>
                    )}
                    {curator.legalName && (
                      <div className="flex justify-between">
                        <dt className="text-text-tertiary">Legal Name</dt>
                        <dd className="font-medium text-text-primary text-right">{curator.legalName}</dd>
                      </div>
                    )}
                  </dl>
                </section>
              </div>

              {/* Right Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Asset Distribution */}
                <section className="bg-background-subtle rounded-lg border border-border p-6">
                  <h2 className="text-sm font-semibold text-text-primary mb-4">Asset Distribution</h2>
                  <div className="space-y-3">
                    {assetDistribution.map((asset) => (
                      <div key={asset.symbol} className="flex items-center gap-4">
                        <div className="w-16 text-sm font-medium text-text-primary">{asset.symbol}</div>
                        <div className="flex-1">
                          <div className="h-2 bg-background-elevated rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent-blue rounded-full"
                              style={{ width: `${asset.percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-20 text-right text-sm text-text-secondary tabular-nums">
                          {formatCurrency(asset.amount)}
                        </div>
                        <div className="w-12 text-right text-sm text-text-muted tabular-nums">
                          {asset.percentage.toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Recent News */}
                <section className="bg-background-subtle rounded-lg border border-border">
                  <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-text-primary">Recent News</h2>
                  </div>
                  {news.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <p className="text-sm text-text-tertiary">No recent news.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {news.slice(0, 3).map((item) => (
                        <a
                          key={item.id}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-4 px-6 py-4 hover:bg-background-hover transition-colors group"
                        >
                          <CategoryIcon category={item.category} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-xs font-medium uppercase ${getSentimentColor(item.sentiment)}`}>
                                {item.category || "Update"}
                              </span>
                              <span className="text-xs text-text-muted">•</span>
                              <span className="text-xs text-text-muted">{formatTimeAgo(item.publishedAt)}</span>
                            </div>
                            <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                              {item.title}
                            </p>
                          </div>
                          <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-accent-blue transition-colors flex-shrink-0 mt-1" />
                        </a>
                      ))}
                    </div>
                  )}
                </section>

                {/* Top Depositors */}
                <CuratorDepositors curatorAddress={curator.address} />
              </div>
            </div>
          </TabsContent>

          {/* Vaults Tab */}
          <TabsContent value="vaults" className="pt-6">
            <section className="bg-background-subtle rounded-lg border border-border">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">
                    Vaults Managed ({vaults.length})
                  </h2>
                  <p className="text-xs text-text-tertiary mt-1">
                    {curator.name || "This curator"} manages {vaults.length} vault{vaults.length !== 1 ? "s" : ""} totaling {formatCurrency(totalTVL)}
                  </p>
                </div>
              </div>
              {vaults.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-text-tertiary">No vaults found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-background-elevated border-b border-border">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Vault
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Asset
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                          TVL
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                          APY
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                          Net APY
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {vaults.map((vault) => (
                        <tr key={vault.id} className="hover:bg-background-hover transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link href={`/vault/${vault.address}`} className="flex items-center gap-3 group">
                              <div className={`w-8 h-8 rounded-lg ${getVaultColor(vault.address)} flex items-center justify-center text-white font-bold text-xs`}>
                                {vault.symbol.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                                  {vault.name}
                                </div>
                                <div className="text-xs text-text-tertiary font-mono">
                                  {formatAddress(vault.address)}
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-background-elevated border border-border text-text-primary">
                              {vault.asset.symbol}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm font-semibold text-text-primary tabular-nums">
                              {formatCurrency(vault.latestSnapshot?.totalAssetsUsd)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm text-text-secondary tabular-nums">
                              {formatPercentage(vault.latestSnapshot?.avgApy)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className="text-sm font-medium text-accent-green tabular-nums">
                              {formatPercentage(vault.latestSnapshot?.avgNetApy)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="pt-6">
            <div className="space-y-6">
              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-background-subtle rounded-lg border border-accent-blue/30 bg-accent-blue/5 p-4">
                  <p className="text-xs text-text-tertiary mb-1">Total AUM</p>
                  <p className="text-xl font-semibold text-accent-blue tabular-nums">{formatCurrency(totalTVL)}</p>
                </div>
                <div className="bg-background-subtle rounded-lg border border-border p-4">
                  <p className="text-xs text-text-tertiary mb-1">Weighted Avg APY</p>
                  <p className="text-xl font-semibold text-accent-green tabular-nums">{formatPercentage(avgApy)}</p>
                </div>
                <div className="bg-background-subtle rounded-lg border border-border p-4">
                  <p className="text-xs text-text-tertiary mb-1">Active Vaults</p>
                  <p className="text-xl font-semibold text-text-primary tabular-nums">{vaults.length}</p>
                </div>
                <div className="bg-background-subtle rounded-lg border border-border p-4">
                  <p className="text-xs text-text-tertiary mb-1">Positive APY Rate</p>
                  <p className="text-xl font-semibold text-accent-green tabular-nums">
                    {vaults.length > 0 ? Math.round((vaults.filter(v => (v.latestSnapshot?.avgNetApy ?? 0) > 0).length / vaults.length) * 100) : 0}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AUM Breakdown */}
                <section className="bg-background-subtle rounded-lg border border-border">
                  <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-text-primary">AUM Breakdown</h2>
                    <p className="text-xs text-text-tertiary mt-1">Distribution of assets under management</p>
                  </div>
                  <div className="p-6 space-y-4">
                    {assetDistribution.slice(0, 5).map((asset, index) => (
                      <div key={asset.symbol} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-accent-blue/15 text-accent-blue text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="font-medium text-text-primary">{asset.symbol}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium text-text-primary tabular-nums">{formatCurrency(asset.amount)}</span>
                            <span className="text-text-muted ml-2 tabular-nums">{asset.percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-background-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-blue rounded-full transition-all"
                            style={{ width: `${Math.min(asset.percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {assetDistribution.length > 5 && (
                      <p className="text-xs text-text-muted text-center pt-2">
                        +{assetDistribution.length - 5} more asset{assetDistribution.length - 5 !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </section>

                {/* Yield Analysis */}
                <section className="bg-background-subtle rounded-lg border border-border">
                  <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-text-primary">Yield Analysis</h2>
                    <p className="text-xs text-text-tertiary mt-1">APY performance across vaults</p>
                  </div>
                  <div className="p-6 space-y-4">
                    {(() => {
                      const apys = vaults.map(v => v.latestSnapshot?.avgNetApy ?? 0).filter(a => a > 0);
                      const maxApy = apys.length > 0 ? Math.max(...apys) : 0;
                      const minApy = apys.length > 0 ? Math.min(...apys) : 0;
                      const medianApy = apys.length > 0
                        ? [...apys].sort((a, b) => a - b)[Math.floor(apys.length / 2)]
                        : 0;
                      return (
                        <>
                          <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                            <span className="text-sm text-text-tertiary">Highest APY</span>
                            <span className="text-sm font-semibold text-accent-green tabular-nums">{formatPercentage(maxApy)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                            <span className="text-sm text-text-tertiary">Median APY</span>
                            <span className="text-sm font-semibold text-text-primary tabular-nums">{formatPercentage(medianApy)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                            <span className="text-sm text-text-tertiary">Lowest APY</span>
                            <span className="text-sm font-semibold text-accent-yellow tabular-nums">{formatPercentage(minApy)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                            <span className="text-sm text-text-tertiary">APY Spread</span>
                            <span className="text-sm font-semibold text-text-primary tabular-nums">{formatPercentage(maxApy - minApy)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-sm text-text-tertiary">Weighted Avg APY</span>
                            <span className="text-sm font-semibold text-accent-blue tabular-nums">{formatPercentage(avgApy)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </section>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk-Adjusted Metrics */}
                <section className="bg-background-subtle rounded-lg border border-border">
                  <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-text-primary">Risk-Adjusted Metrics</h2>
                    <p className="text-xs text-text-tertiary mt-1">Performance relative to risk taken</p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-background-elevated rounded-lg p-4 text-center">
                        <p className="text-xs text-text-tertiary mb-1">Consistency Score</p>
                        <p className="text-2xl font-bold text-accent-blue">
                          {(() => {
                            const apys = vaults.map(v => v.latestSnapshot?.avgNetApy ?? 0).filter(a => a > 0);
                            if (apys.length < 2) return "N/A";
                            const avg = apys.reduce((s, a) => s + a, 0) / apys.length;
                            const variance = apys.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / apys.length;
                            const cv = Math.sqrt(variance) / Math.abs(avg);
                            return Math.max(0, Math.round((1 - cv) * 100));
                          })()}
                        </p>
                        <p className="text-xs text-text-muted">of 100</p>
                      </div>
                      <div className="bg-background-elevated rounded-lg p-4 text-center">
                        <p className="text-xs text-text-tertiary mb-1">Win Rate</p>
                        <p className="text-2xl font-bold text-accent-green">
                          {vaults.length > 0 ? Math.round((vaults.filter(v => (v.latestSnapshot?.avgNetApy ?? 0) > 0).length / vaults.length) * 100) : 0}%
                        </p>
                        <p className="text-xs text-text-muted">vaults earning yield</p>
                      </div>
                      <div className="bg-background-elevated rounded-lg p-4 text-center">
                        <p className="text-xs text-text-tertiary mb-1">Diversification</p>
                        <p className={`text-2xl font-bold ${vaults.length >= 5 ? "text-accent-green" : vaults.length >= 3 ? "text-accent-yellow" : "text-accent-red"}`}>
                          {vaults.length >= 5 ? "High" : vaults.length >= 3 ? "Medium" : "Low"}
                        </p>
                        <p className="text-xs text-text-muted">{vaults.length} vault{vaults.length !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="bg-background-elevated rounded-lg p-4 text-center">
                        <p className="text-xs text-text-tertiary mb-1">Risk Grade</p>
                        <p className={`text-2xl font-bold ${
                          avgApy > 10 && vaults.length >= 3 ? "text-accent-green" :
                          avgApy > 5 ? "text-accent-blue" : "text-accent-yellow"
                        }`}>
                          {avgApy > 10 && vaults.length >= 3 ? "A" :
                           avgApy > 8 ? "B" :
                           avgApy > 5 ? "C" : "D"}
                        </p>
                        <p className="text-xs text-text-muted">overall rating</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Efficiency Metrics */}
                <section className="bg-background-subtle rounded-lg border border-border">
                  <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-text-primary">Efficiency Metrics</h2>
                    <p className="text-xs text-text-tertiary mt-1">Operational efficiency indicators</p>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                      <span className="text-sm text-text-tertiary">Avg AUM per Vault</span>
                      <span className="text-sm font-semibold text-text-primary tabular-nums">
                        {formatCurrency(vaults.length > 0 ? totalTVL / vaults.length : 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                      <span className="text-sm text-text-tertiary">Largest Vault Share</span>
                      <span className="text-sm font-semibold text-text-primary tabular-nums">
                        {(() => {
                          const largest = vaults.reduce((max, v) => {
                            const tvl = v.latestSnapshot?.totalAssetsUsd ?? 0;
                            return tvl > (max?.latestSnapshot?.totalAssetsUsd ?? 0) ? v : max;
                          }, vaults[0]);
                          return totalTVL > 0 && largest
                            ? `${((largest.latestSnapshot?.totalAssetsUsd ?? 0) / totalTVL * 100).toFixed(1)}%`
                            : "0%";
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                      <span className="text-sm text-text-tertiary">Asset Diversity</span>
                      <span className="text-sm font-semibold text-text-primary tabular-nums">
                        {assetDistribution.length} asset{assetDistribution.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-text-tertiary">Concentration Index</span>
                      <span className={`text-sm font-semibold tabular-nums ${
                        assetDistribution[0]?.percentage > 70 ? "text-accent-red" :
                        assetDistribution[0]?.percentage > 50 ? "text-accent-yellow" : "text-accent-green"
                      }`}>
                        {assetDistribution[0]?.percentage.toFixed(0) ?? 0}%
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Vault Performance Comparison */}
              <section className="bg-background-subtle rounded-lg border border-border">
                <div className="px-6 py-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-text-primary">Vault Performance Comparison</h2>
                  <p className="text-xs text-text-tertiary mt-1">APY performance ranked by yield</p>
                </div>
                <div className="p-6 space-y-3">
                  {vaults
                    .sort((a, b) => (b.latestSnapshot?.avgNetApy ?? 0) - (a.latestSnapshot?.avgNetApy ?? 0))
                    .map((vault, index) => (
                      <div key={vault.id} className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${
                          index === 0 ? "bg-accent-green/15 text-accent-green" :
                          index === 1 ? "bg-accent-blue/15 text-accent-blue" :
                          index === 2 ? "bg-purple-500/15 text-purple-400" : "bg-background-elevated text-text-muted"
                        }`}>
                          {index + 1}
                        </span>
                        <div className="w-32 text-sm font-medium text-text-primary truncate">{vault.name}</div>
                        <div className="flex-1">
                          <div className="h-2 bg-background-elevated rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                index === 0 ? "bg-accent-green" :
                                index === 1 ? "bg-accent-blue" :
                                index === 2 ? "bg-purple-500" : "bg-text-muted"
                              }`}
                              style={{
                                width: `${Math.min(((vault.latestSnapshot?.avgNetApy ?? 0) / 20) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          <span className="text-sm font-medium text-accent-green tabular-nums">
                            {formatPercentage(vault.latestSnapshot?.avgNetApy)}
                          </span>
                        </div>
                        <div className="w-24 text-right">
                          <span className="text-xs text-text-muted tabular-nums">
                            {formatCurrency(vault.latestSnapshot?.totalAssetsUsd)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="pt-6">
            <section className="bg-background-subtle rounded-lg border border-border">
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-text-primary">News & Activity</h2>
              </div>
              {news.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <svg className="mx-auto h-12 w-12 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  <p className="mt-4 text-sm text-text-tertiary">No recent activity.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {news.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-4 px-6 py-4 hover:bg-background-hover transition-colors group"
                    >
                      <CategoryIcon category={item.category} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs font-medium uppercase ${getSentimentColor(item.sentiment)}`}>
                            {item.category || "Update"}
                          </span>
                          <span className="text-xs text-text-muted">•</span>
                          <span className="text-xs text-text-muted">{item.source}</span>
                          <span className="text-xs text-text-muted">•</span>
                          <span className="text-xs text-text-muted">{formatTimeAgo(item.publishedAt)}</span>
                        </div>
                        <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                          {item.title}
                        </p>
                        {item.summary && (
                          <p className="text-xs text-text-tertiary mt-1 line-clamp-2">
                            {item.summary}
                          </p>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-text-muted group-hover:text-accent-blue transition-colors flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          {/* Risk Profile Tab */}
          <TabsContent value="risk" className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Strategy Classification */}
              <section className="bg-background-subtle rounded-lg border border-border p-6 text-center">
                <h2 className="text-sm font-semibold text-text-primary mb-4">Strategy Classification</h2>
                <div className="inline-flex items-center px-4 py-2 rounded-full text-lg font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/20">
                  Moderate
                </div>
                <p className="mt-4 text-xs text-text-tertiary">
                  Based on concentration levels, liquidity, and reallocation frequency
                </p>
              </section>

              {/* Risk Metrics */}
              <section className="bg-background-subtle rounded-lg border border-border p-6">
                <h2 className="text-sm font-semibold text-text-primary mb-4">Risk Metrics</h2>
                <dl className="space-y-4">
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-text-tertiary">Concentration Risk</dt>
                    <dd className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-yellow" />
                      Medium
                    </dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-text-tertiary">Liquidity Risk</dt>
                    <dd className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-green/15 text-accent-green border border-accent-green/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                      Low
                    </dd>
                  </div>
                  <div className="flex justify-between items-center">
                    <dt className="text-sm text-text-tertiary">Diversification</dt>
                    <dd className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent-green/15 text-accent-green border border-accent-green/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                      Good
                    </dd>
                  </div>
                </dl>
              </section>

              {/* Management Style */}
              <section className="bg-background-subtle rounded-lg border border-border p-6">
                <h2 className="text-sm font-semibold text-text-primary mb-4">Management Style</h2>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-accent-blue mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-text-secondary">
                      Manages {vaults.length} vault{vaults.length !== 1 ? "s" : ""} with diversified allocations
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-accent-blue mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-text-secondary">
                      {assetDistribution.length} different asset{assetDistribution.length !== 1 ? "s" : ""} under management
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-accent-blue mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-text-secondary">
                      {curator.jurisdiction ? `Operates from ${curator.jurisdiction}` : "Jurisdiction not specified"}
                    </span>
                  </li>
                </ul>
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
  valueClass,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueClass?: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${
      highlight ? "border-accent-blue/30 bg-accent-blue/5" : "border-border bg-background-subtle"
    }`}>
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${
        valueClass || (highlight ? "text-accent-blue" : "text-text-primary")
      }`}>
        {value}
      </p>
    </div>
  );
}

function getSentimentColor(sentiment: string | null) {
  switch (sentiment) {
    case "positive":
      return "text-accent-green";
    case "negative":
      return "text-accent-red";
    default:
      return "text-accent-blue";
  }
}

function CategoryIcon({ category }: { category: string | null }) {
  switch (category) {
    case "partnership":
      return (
        <div className="w-8 h-8 rounded-lg bg-accent-green/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      );
    case "audit":
      return (
        <div className="w-8 h-8 rounded-lg bg-accent-green/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
      );
    case "incident":
      return (
        <div className="w-8 h-8 rounded-lg bg-accent-red/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="w-8 h-8 rounded-lg bg-accent-blue/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
  }
}

function CuratorDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      <header className="bg-background-subtle border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="h-4 w-24 bg-background-elevated rounded mb-4" />
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-background-elevated rounded-xl" />
            <div>
              <div className="h-6 w-48 bg-background-elevated rounded mb-2" />
              <div className="h-4 w-32 bg-background-elevated rounded" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-background-subtle rounded-lg border border-border p-4">
              <div className="h-3 w-16 bg-background-elevated rounded mb-2" />
              <div className="h-6 w-20 bg-background-elevated rounded" />
            </div>
          ))}
        </div>

        <div className="bg-background-subtle rounded-lg border border-border p-6">
          <div className="flex gap-4 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-24 bg-background-elevated rounded" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-background-elevated rounded" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

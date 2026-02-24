"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import {
  formatCurrency,
  formatPercentage,
  formatAddress,
  formatTimeAgo,
  formatDate,
} from "@/lib/utils/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/Tabs";
import { CuratorDepositors } from "@/components/CuratorDepositors";
import { CuratorAvatar, CuratorAvatarFallback } from "@/components/CuratorAvatar";
import { CopyAddress } from "@/components/CopyAddress";
import { CuratorRating } from "@/components/CuratorRating";
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
  const hash = address.split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return colors[Math.abs(hash) % colors.length];
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
              <Image src="/logo.png" alt="CuratorWatch" width={32} height={32} className="rounded-lg" />
              <span className="text-sm font-bold text-text-primary hidden sm:inline">CuratorWatch</span>
            </Link>
            <nav className="flex items-center gap-4 ml-auto">
              <Link href="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                Curators
              </Link>
              <Link href="/vaults" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                All Vaults
              </Link>
              <Link href="/yields" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
                Economics
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
                  href={`https://x.com/${curator.twitter}`}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
            <TabsTrigger value="economics">Economics</TabsTrigger>
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
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-text-primary">
                Vaults Managed ({vaults.length})
              </h2>
              <p className="text-xs text-text-tertiary mt-1">
                {curator.name || "This curator"} manages {vaults.length} vault{vaults.length !== 1 ? "s" : ""} totaling {formatCurrency(totalTVL)}
              </p>
            </div>
            {vaults.length === 0 ? (
              <div className="bg-background-subtle rounded-lg border border-border px-6 py-12 text-center">
                <p className="text-sm text-text-tertiary">No vaults found.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  const vaultsByAsset: Record<string, typeof vaults> = {};
                  vaults.forEach((v) => {
                    const asset = v.asset.symbol;
                    if (!vaultsByAsset[asset]) vaultsByAsset[asset] = [];
                    vaultsByAsset[asset].push(v);
                  });
                  const sortedAssets = Object.entries(vaultsByAsset).sort(
                    (a, b) => {
                      const aTvl = a[1].reduce((s, v) => s + (v.latestSnapshot?.totalAssetsUsd ?? 0), 0);
                      const bTvl = b[1].reduce((s, v) => s + (v.latestSnapshot?.totalAssetsUsd ?? 0), 0);
                      return bTvl - aTvl;
                    }
                  );
                  return sortedAssets.map(([asset, assetVaults]) => {
                    const assetTvl = assetVaults.reduce((s, v) => s + (v.latestSnapshot?.totalAssetsUsd ?? 0), 0);
                    return (
                      <section key={asset} className="bg-background-subtle rounded-lg border border-border">
                        <div className="px-6 py-3 border-b border-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-background-elevated border border-border text-text-primary">
                              {asset}
                            </span>
                            <span className="text-xs text-text-tertiary">
                              {assetVaults.length} vault{assetVaults.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-text-secondary tabular-nums">
                            {formatCurrency(assetTvl)}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-background-elevated/50">
                              <tr>
                                <th className="px-6 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                                  Vault
                                </th>
                                <th className="px-6 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                                  Deposits
                                </th>
                                <th className="px-6 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                                  APY
                                </th>
                                <th className="px-6 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                                  Net APY
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                              {assetVaults
                                .sort((a, b) => (b.latestSnapshot?.totalAssetsUsd ?? 0) - (a.latestSnapshot?.totalAssetsUsd ?? 0))
                                .map((vault) => (
                                <tr key={vault.id} className="hover:bg-background-hover transition-colors">
                                  <td className="px-6 py-3.5 whitespace-nowrap">
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
                                  <td className="px-6 py-3.5 whitespace-nowrap text-right">
                                    <span className="text-sm font-semibold text-text-primary tabular-nums">
                                      {formatCurrency(vault.latestSnapshot?.totalAssetsUsd)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3.5 whitespace-nowrap text-right">
                                    <span className="text-sm text-text-secondary tabular-nums">
                                      {formatPercentage(vault.latestSnapshot?.avgApy)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3.5 whitespace-nowrap text-right">
                                    <span className="text-sm font-medium text-accent-green tabular-nums">
                                      {formatPercentage(vault.latestSnapshot?.avgNetApy)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    );
                  });
                })()}
              </div>
            )}
          </TabsContent>

          {/* Economics Tab */}
          <TabsContent value="economics" className="pt-6">
            {(() => {
              const vaultEcon = vaults.map((v) => {
                const tvl = v.latestSnapshot?.totalAssetsUsd ?? 0;
                const netApy = v.latestSnapshot?.avgNetApy ?? 0;
                const fee = v.performanceFee ?? 0;
                const annualYield = tvl * netApy;
                const annualFees = tvl * fee;
                return { ...v, tvl, netApy, fee, annualYield, annualFees };
              });

              const totalAnnualYield = vaultEcon.reduce((s, v) => s + v.annualYield, 0);
              const totalAnnualFees = vaultEcon.reduce((s, v) => s + v.annualFees, 0);
              const netToLPs = totalAnnualYield - totalAnnualFees;
              const weightedApy = totalTVL > 0
                ? vaultEcon.reduce((s, v) => s + v.netApy * v.tvl, 0) / totalTVL
                : 0;
              const avgFee = vaultEcon.length > 0
                ? vaultEcon.reduce((s, v) => s + v.fee, 0) / vaultEcon.length
                : 0;

              // Group by asset
              const assetEcon: Record<string, { aum: number; yield: number; fees: number; feeRates: number[]; vaults: typeof vaultEcon }> = {};
              for (const v of vaultEcon) {
                const sym = v.asset.symbol;
                if (!assetEcon[sym]) assetEcon[sym] = { aum: 0, yield: 0, fees: 0, feeRates: [], vaults: [] };
                assetEcon[sym].aum += v.tvl;
                assetEcon[sym].yield += v.annualYield;
                assetEcon[sym].fees += v.annualFees;
                assetEcon[sym].feeRates.push(v.fee);
                assetEcon[sym].vaults.push(v);
              }
              const sortedAssetEcon = Object.entries(assetEcon).sort((a, b) => b[1].aum - a[1].aum);

              return (
                <div className="space-y-6">
                  {/* Top Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Total AUM" value={formatCurrency(totalTVL)} highlight />
                    <StatCard
                      label="Annual Yield"
                      value={formatCurrency(totalAnnualYield)}
                      valueClass="text-accent-green"
                    />
                    <StatCard
                      label="Annual Fees"
                      value={formatCurrency(totalAnnualFees)}
                      valueClass="text-accent-blue"
                    />
                    <StatCard
                      label="Net to LPs"
                      value={formatCurrency(netToLPs)}
                      valueClass="text-accent-green"
                    />
                  </div>

                  {/* Supplementary stats */}
                  <div className="flex items-center gap-6 px-1">
                    <span className="text-sm text-text-secondary">
                      Weighted APY: <span className="font-semibold text-accent-green tabular-nums">{formatPercentage(weightedApy)}</span>
                    </span>
                    <span className="text-sm text-text-secondary">
                      Avg Fee: <span className="font-semibold text-text-primary tabular-nums">{formatPercentage(avgFee)}</span>
                    </span>
                  </div>

                  {/* Vault Economics Table */}
                  <section className="bg-background-subtle rounded-lg border border-border overflow-hidden">
                    <div className="px-6 py-4 border-b border-border">
                      <h2 className="text-sm font-semibold text-text-primary">Vault Economics</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-background-elevated/50">
                            <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Vault</th>
                            <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">TVL</th>
                            <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">APY</th>
                            <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Fee</th>
                            <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Annual Yield</th>
                            <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Annual Fees</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {vaultEcon
                            .sort((a, b) => b.annualFees - a.annualFees)
                            .map((v) => (
                            <tr key={v.id} className="hover:bg-background-elevated/30 transition-colors">
                              <td className="px-4 py-3">
                                <Link href={`/vault/${v.address}`} className="group">
                                  <span className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                                    {v.name}
                                  </span>
                                  <span className="block text-xs text-text-tertiary">{v.asset.symbol}</span>
                                </Link>
                              </td>
                              <td className="text-right px-4 py-3">
                                <span className="text-sm font-medium text-text-primary tabular-nums">
                                  {formatCurrency(v.tvl)}
                                </span>
                              </td>
                              <td className="text-right px-4 py-3">
                                <span className="text-sm text-accent-green font-medium tabular-nums">
                                  {formatPercentage(v.netApy)}
                                </span>
                              </td>
                              <td className="text-right px-4 py-3">
                                <span className="text-sm text-text-secondary tabular-nums">
                                  {formatPercentage(v.fee)}
                                </span>
                              </td>
                              <td className="text-right px-4 py-3">
                                <span className="text-sm font-semibold text-accent-green tabular-nums">
                                  {formatCurrency(v.annualYield)}
                                </span>
                              </td>
                              <td className="text-right px-4 py-3">
                                <span className="text-sm font-semibold text-accent-blue tabular-nums">
                                  {formatCurrency(v.annualFees)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Asset Breakdown */}
                  <section className="bg-background-subtle rounded-lg border border-border">
                    <div className="px-6 py-4 border-b border-border">
                      <h2 className="text-sm font-semibold text-text-primary">By Asset</h2>
                    </div>
                    <div className="divide-y divide-border">
                      {sortedAssetEcon.map(([symbol, data]) => {
                        const assetAvgFee = data.feeRates.length > 0
                          ? data.feeRates.reduce((s, f) => s + f, 0) / data.feeRates.length
                          : 0;
                        return (
                          <div key={symbol} className="px-6 py-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-background-elevated border border-border text-text-primary">
                                  {symbol}
                                </span>
                                <span className="text-sm font-medium text-text-primary tabular-nums">
                                  {formatCurrency(data.aum)} AUM
                                </span>
                              </div>
                              <span className="text-xs text-text-tertiary">
                                {data.vaults.length} vault{data.vaults.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-text-secondary">
                              <span className="tabular-nums">
                                <span className="text-accent-green font-medium">{formatCurrency(data.yield)}</span> yield
                              </span>
                              <span className="text-text-muted">&rarr;</span>
                              <span className="tabular-nums">
                                <span className="text-accent-blue font-medium">{formatCurrency(data.fees)}</span> fees
                              </span>
                              <span className="text-text-muted">
                                ({formatPercentage(assetAvgFee)} avg fee)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Liquidations */}
                  {data.liquidationSummary && (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <StatCard
                          label="Total Liquidations"
                          value={data.liquidationSummary.total.toString()}
                          valueClass={data.liquidationSummary.total > 0 ? "text-accent-red" : undefined}
                        />
                        <StatCard
                          label="Bad Debt (All-Time)"
                          value={formatCurrency(data.liquidationSummary.totalBadDebtUsd)}
                          valueClass={data.liquidationSummary.totalBadDebtUsd > 0 ? "text-accent-red" : undefined}
                        />
                        <StatCard
                          label="Last 30 Days"
                          value={data.liquidationSummary.recent30d.toString()}
                          valueClass={data.liquidationSummary.recent30d > 0 ? "text-accent-red" : undefined}
                        />
                      </div>

                      {data.liquidationSummary.events.length > 0 && (
                        <section className="bg-background-subtle rounded-lg border border-border overflow-hidden">
                          <div className="px-6 py-4 border-b border-border">
                            <h2 className="text-sm font-semibold text-text-primary">Recent Liquidations</h2>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-border bg-background-elevated/50">
                                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Date</th>
                                  <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Market</th>
                                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Collateral Seized</th>
                                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Debt Repaid</th>
                                  <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Bad Debt</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {data.liquidationSummary.events.map((event, i) => (
                                  <tr key={`${event.txHash}-${i}`} className="hover:bg-background-elevated/30 transition-colors">
                                    <td className="px-4 py-3">
                                      <span className="text-sm text-text-secondary">{formatDate(event.timestamp)}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-sm text-text-tertiary font-mono">{formatAddress(event.marketUniqueKey)}</span>
                                    </td>
                                    <td className="text-right px-4 py-3">
                                      <span className="text-sm font-medium text-accent-red tabular-nums">{formatCurrency(event.seizedAssetsUsd)}</span>
                                    </td>
                                    <td className="text-right px-4 py-3">
                                      <span className="text-sm font-medium text-text-primary tabular-nums">{formatCurrency(event.repaidAssetsUsd)}</span>
                                    </td>
                                    <td className="text-right px-4 py-3">
                                      <span className={`text-sm font-medium tabular-nums ${event.badDebtAssetsUsd > 0 ? "text-accent-red" : "text-text-muted"}`}>
                                        {event.badDebtAssetsUsd > 0 ? formatCurrency(event.badDebtAssetsUsd) : "-"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </TabsContent>

          {/* Risk Profile Tab */}
          <TabsContent value="risk" className="pt-6">
            <CuratorRating curatorAddress={curator.address} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border bg-background-subtle mt-auto">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <p>
              Data from{" "}
              <a href="https://api.morpho.org/graphql" target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:text-accent-blue-hover">Morpho API</a>
              {" "}• Updated hourly
            </p>
            <div className="flex items-center gap-3">
              <a href="https://x.com/curator_watch" target="_blank" rel="noopener noreferrer" className="text-text-tertiary hover:text-text-primary transition-colors" title="Follow us on X">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
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

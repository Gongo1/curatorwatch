"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
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
import type { CuratorDetailResponse } from "@/lib/types/api";

const CuratorVaultGrid = dynamic(() => import("@/components/grid/CuratorVaultGrid").then(mod => mod.CuratorVaultGrid), {
  ssr: false,
  loading: () => <div className="h-64 bg-background-elevated rounded-xl animate-pulse" />,
});
import { NetworkBadgeList } from "@/components/NetworkBadge";
import { VaultGradeBadge } from "@/components/VaultGradeBadge";
import { CuratorRiskProfile } from "@/components/CuratorRiskProfile";
import { usePortfolio } from "@/hooks/usePortfolio";
import { TrackVaultPrompt } from "@/components/TrackVaultPrompt";

interface PageProps {
  params: Promise<{ address: string }>;
}

export default function CuratorDetailPage({ params }: PageProps) {
  const { address } = use(params);
  const [data, setData] = useState<CuratorDetailResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTrackPrompt, setShowTrackPrompt] = useState(false);
  const { isCuratorTracked, trackCurator, untrackCurator } = usePortfolio();

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
      <div className="py-8">
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
    );
  }

  const { curator, vaults, news } = data;
  const isTracked = isCuratorTracked(curator.id);

  // Calculate aggregate stats
  const totalTVL = vaults.reduce((sum, v) => sum + (v.latestSnapshot?.totalAssetsUsd ?? 0), 0);

  // Asset distribution
  const assetMap: Record<string, number> = {};
  vaults.forEach(v => {
    const tvl = v.latestSnapshot?.totalAssetsUsd ?? 0;
    assetMap[v.asset.symbol] = (assetMap[v.asset.symbol] || 0) + tvl;
  });
  // Collect unique networks
  const networkSet = new Set<string>();
  vaults.forEach(v => {
    networkSet.add(v.chainName ?? "Ethereum");
  });
  const networks = Array.from(networkSet);

  const assetDistribution = Object.entries(assetMap)
    .map(([symbol, amount]) => ({
      symbol,
      amount,
      percentage: totalTVL > 0 ? (amount / totalTVL) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <>
      <PageHeader
        title={curator.name && curator.name !== "Unknown" ? curator.name : `Curator ${formatAddress(curator.address)}`}
        description={`Managing ${formatCurrency(totalTVL)} across ${vaults.length} vault${vaults.length !== 1 ? "s" : ""}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Curators", href: "/" },
          { label: curator.name || formatAddress(curator.address) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <CuratorAvatar address={curator.address} name={curator.name} logoUrl={curator.logoUrl} size="lg" />
            <NetworkBadgeList networks={networks} size="md" />
            {curator.website && (
              <a href={curator.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-background-elevated hover:bg-background-hover border border-border transition-colors text-sm">
                <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                <span className="text-text-secondary">Website</span>
              </a>
            )}
            {curator.twitter && (
              <a href={`https://x.com/${curator.twitter}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-background-elevated hover:bg-background-hover border border-border transition-colors" title="Twitter/X">
                <svg className="w-4 h-4 text-text-tertiary" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </a>
            )}
            <button
              onClick={() => isTracked ? untrackCurator(curator.id) : trackCurator(curator.id, curator.name || "Unknown")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isTracked
                  ? "bg-accent-blue/10 border border-accent-blue/20 text-accent-blue"
                  : "bg-background-elevated border border-border text-text-secondary hover:bg-background-hover"
              }`}
            >
              {isTracked ? "Tracking \u2713" : "Track"}
            </button>
          </div>
        }
      />

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
            <TabsTrigger value="risk-profile">Risk Profile</TabsTrigger>
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
              <CuratorVaultGrid vaults={vaults} />
            )}
          </TabsContent>

          {/* Economics Tab */}
          <TabsContent value="economics" className="pt-6">
            {(() => {
              const vaultEcon = vaults.map((v) => {
                const tvl = v.latestSnapshot?.totalAssetsUsd ?? 0;
                const isTurtle = v.dataSource === "turtle";
                // Turtle vaults store APR in netAPR (as percentage), Morpho uses snapshot avgNetApy (as decimal)
                const netApy = isTurtle
                  ? (v.netAPR ?? 0) / 100
                  : (v.latestSnapshot?.avgNetApy ?? 0);
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

              // Split by source
              const morphoVaults = vaultEcon.filter((v) => v.dataSource !== "turtle");
              const turtleVaults = vaultEcon.filter((v) => v.dataSource === "turtle");
              const hasBothSources = morphoVaults.length > 0 && turtleVaults.length > 0;

              // Source-level stats for supplementary line
              const morphoTVL = morphoVaults.reduce((s, v) => s + v.tvl, 0);
              const turtleTVL = turtleVaults.reduce((s, v) => s + v.tvl, 0);
              const morphoYield = morphoVaults.reduce((s, v) => s + v.annualYield, 0);
              const turtleYield = turtleVaults.reduce((s, v) => s + v.annualYield, 0);

              // Group by asset per source
              type AssetEconEntry = { aum: number; yield: number; fees: number; feeRates: number[]; vaults: typeof vaultEcon };
              const groupByAsset = (list: typeof vaultEcon) => {
                const map: Record<string, AssetEconEntry> = {};
                for (const v of list) {
                  const sym = v.asset.symbol;
                  if (!map[sym]) map[sym] = { aum: 0, yield: 0, fees: 0, feeRates: [], vaults: [] };
                  map[sym].aum += v.tvl;
                  map[sym].yield += v.annualYield;
                  map[sym].fees += v.annualFees;
                  map[sym].feeRates.push(v.fee);
                  map[sym].vaults.push(v);
                }
                return Object.entries(map).sort((a, b) => b[1].aum - a[1].aum);
              };

              // Render a vault economics table
              const renderEconTable = (
                rows: typeof vaultEcon,
                title: string,
                rateLabel: string,
              ) => (
                <section className="bg-background-subtle rounded-lg border border-border overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-background-elevated/50">
                          <th className="text-left text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Vault</th>
                          <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">TVL</th>
                          <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">{rateLabel}</th>
                          <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Fee</th>
                          <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Annual Yield</th>
                          <th className="text-right text-xs font-medium text-text-secondary uppercase tracking-wider px-4 py-3">Annual Fees</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {[...rows]
                          .sort((a, b) => b.annualFees - a.annualFees)
                          .map((v) => (
                          <tr key={v.id} className="hover:bg-background-elevated/30 transition-colors">
                            <td className="px-4 py-3">
                              <Link href={`/vault/${v.address}`} className="group">
                                <div className="flex items-center text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                                  {v.name}
                                  <VaultGradeBadge grade={v.grade} failures={v.gradeFailures} />
                                </div>
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
              );

              // Render an asset breakdown section
              const renderAssetBreakdown = (
                entries: [string, AssetEconEntry][],
                title: string,
              ) => (
                <section className="bg-background-subtle rounded-lg border border-border">
                  <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
                  </div>
                  <div className="divide-y divide-border">
                    {entries.map(([symbol, d]) => {
                      const assetAvgFee = d.feeRates.length > 0
                        ? d.feeRates.reduce((s, f) => s + f, 0) / d.feeRates.length
                        : 0;
                      return (
                        <div key={symbol} className="px-6 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-background-elevated border border-border text-text-primary">
                                {symbol}
                              </span>
                              <span className="text-sm font-medium text-text-primary tabular-nums">
                                {formatCurrency(d.aum)} AUM
                              </span>
                            </div>
                            <span className="text-xs text-text-tertiary">
                              {d.vaults.length} vault{d.vaults.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-text-secondary">
                            <span className="tabular-nums">
                              <span className="text-accent-green font-medium">{formatCurrency(d.yield)}</span> yield
                            </span>
                            <span className="text-text-muted">&rarr;</span>
                            <span className="tabular-nums">
                              <span className="text-accent-blue font-medium">{formatCurrency(d.fees)}</span> fees
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
              );

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
                  <div className="flex flex-wrap items-center gap-6 px-1">
                    <span className="text-sm text-text-secondary">
                      Weighted APY: <span className="font-semibold text-accent-green tabular-nums">{formatPercentage(weightedApy)}</span>
                    </span>
                    <span className="text-sm text-text-secondary">
                      Avg Fee: <span className="font-semibold text-text-primary tabular-nums">{formatPercentage(avgFee)}</span>
                    </span>
                    {hasBothSources && (
                      <>
                        <span className="text-xs text-text-muted">|</span>
                        <span className="text-sm text-text-tertiary">
                          Morpho: {formatCurrency(morphoTVL)} AUM, {formatCurrency(morphoYield)} yield
                        </span>
                        <span className="text-sm text-text-tertiary">
                          Turtle: {formatCurrency(turtleTVL)} AUM, {formatCurrency(turtleYield)} yield
                        </span>
                      </>
                    )}
                  </div>

                  {/* Vault Economics Table(s) */}
                  {hasBothSources ? (
                    <>
                      {renderEconTable(morphoVaults, "Morpho Vault Economics", "APY")}
                      {renderEconTable(turtleVaults, "Turtle Vault Economics", "APR")}
                    </>
                  ) : turtleVaults.length > 0 ? (
                    renderEconTable(turtleVaults, "Vault Economics", "APR")
                  ) : (
                    renderEconTable(morphoVaults, "Vault Economics", "APY")
                  )}

                  {/* Asset Breakdown */}
                  {hasBothSources ? (
                    <>
                      {renderAssetBreakdown(groupByAsset(morphoVaults), "By Asset — Morpho")}
                      {renderAssetBreakdown(groupByAsset(turtleVaults), "By Asset — Turtle")}
                    </>
                  ) : (
                    renderAssetBreakdown(groupByAsset(vaultEcon), "By Asset")
                  )}

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
          <TabsContent value="risk-profile" className="pt-6">
            <CuratorRiskProfile curatorAddress={curator.address} />
          </TabsContent>

        </Tabs>

      <TrackVaultPrompt
        name={curator.name || "Unknown Curator"}
        type="curator"
        open={showTrackPrompt}
        onClose={() => setShowTrackPrompt(false)}
      />
    </>
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
    <div className="animate-pulse">
      <div className="mb-5">
        <div className="h-4 w-48 bg-background-elevated rounded mb-3" />
        <div className="h-7 w-64 bg-background-elevated rounded mb-1" />
        <div className="h-4 w-40 bg-background-elevated rounded" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-background-subtle rounded-lg border border-border p-4">
            <div className="h-3 w-16 bg-background-elevated rounded mb-2" />
            <div className="h-6 w-20 bg-background-elevated rounded" />
          </div>
        ))}
      </div>

      <div className="bg-background-subtle rounded-lg border border-border p-6">
        <div className="flex gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 bg-background-elevated rounded" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-background-elevated rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

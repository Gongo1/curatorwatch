"use client";

import Link from "next/link";
import type { ICellRendererParams } from "ag-grid-community";
import { CuratorAvatar } from "@/components/CuratorAvatar";
import { ProtocolBadgeList } from "@/components/ProtocolBadge";
import { VaultGradeBadge } from "@/components/VaultGradeBadge";
import { NetworkBadgeList } from "@/components/NetworkBadge";
import { formatCurrency, formatPercentage, formatAddress } from "@/lib/utils/format";
import { ChangeCountBadge } from "@/components/RecentChanges";
import { curatorSlug } from "@/lib/curator-aliases";

// Currency cell renderer - font-mono formatted
export function CurrencyRenderer(params: ICellRendererParams) {
  const value = params.value;
  if (value == null) return <span className="text-text-muted">-</span>;
  return (
    <span className="font-mono font-semibold text-text-primary tabular-nums">
      {formatCurrency(value)}
    </span>
  );
}

// Percentage cell renderer - green accent
export function PercentageRenderer(params: ICellRendererParams) {
  const value = params.value;
  if (value == null) return <span className="text-text-muted">-</span>;
  return (
    <span className="font-mono font-medium text-accent-green tabular-nums">
      {formatPercentage(value)}
    </span>
  );
}

// Curator name renderer with avatar and link
export function CuratorNameRenderer(params: ICellRendererParams) {
  const data = params.data;
  if (!data) return null;
  const name = data.name || data.curatorName || "Unknown Curator";
  const address = data.curatorAddress;
  const logoUrl = data.logoUrl;

  return (
    <Link href={`/curator/${curatorSlug(data.name || data.curatorName || null, address)}`} className="flex items-center gap-2.5 group min-w-0">
      <CuratorAvatar address={address} name={name} logoUrl={logoUrl} size="sm" />
      <div className="min-w-0">
        <div className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors truncate">
          {name}
        </div>
        {data.jurisdiction && (
          <div className="text-xs text-text-tertiary truncate">{data.jurisdiction}</div>
        )}
      </div>
    </Link>
  );
}

// Vault name renderer with icon and link
export function VaultNameRenderer(params: ICellRendererParams) {
  const data = params.data;
  if (!data) return null;

  const colors = [
    "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-emerald-500",
    "bg-amber-500", "bg-cyan-500", "bg-indigo-500", "bg-rose-500",
  ];
  const address = data.address || data.vaultAddress || "";
  const hash = address.split("").reduce((sum: number, c: string) => sum + c.charCodeAt(0), 0);
  const color = colors[Math.abs(hash) % colors.length];
  const symbol = data.symbol || data.vaultName?.slice(0, 2) || "??";

  return (
    <Link href={`/vault/${address}`} className="flex items-center gap-2.5 group min-w-0">
      <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0`}>
        {symbol.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="flex items-center text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors truncate">
          {data.name || data.vaultName}
          <VaultGradeBadge grade={data.grade} failures={data.gradeFailures} />
        </div>
        <div className="text-xs text-text-tertiary font-mono">
          {formatAddress(address)}
        </div>
      </div>
    </Link>
  );
}

// Asset badge renderer
export function AssetBadgeRenderer(params: ICellRendererParams) {
  const value = params.value;
  if (!value) return <span className="text-text-muted">-</span>;
  const symbol = typeof value === "object" ? value.symbol : value;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-background-elevated border border-border text-text-primary">
      {symbol}
    </span>
  );
}

// Protocol badges renderer
export function ProtocolBadgesRenderer(params: ICellRendererParams) {
  const protocols = params.value;
  if (!protocols || !Array.isArray(protocols)) return null;
  return <ProtocolBadgeList protocols={protocols} />;
}

// Network badges renderer
export function NetworkBadgesRenderer(params: ICellRendererParams) {
  const networks = params.value;
  if (!networks || !Array.isArray(networks)) return null;
  return <NetworkBadgeList networks={networks} />;
}

// Asset distribution renderer
export function AssetDistributionRenderer(params: ICellRendererParams) {
  const distribution = params.value;
  if (!distribution || !Array.isArray(distribution)) return null;
  return (
    <div className="flex items-center gap-1">
      {distribution.slice(0, 3).map((asset: { symbol: string; percentage: number; amountUsd: number }) => (
        <span
          key={asset.symbol}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-background-elevated border border-border text-text-secondary"
          title={`${asset.symbol}: ${formatCurrency(asset.amountUsd)} (${asset.percentage.toFixed(0)}%)`}
        >
          {asset.symbol}
          <span className="ml-1 text-text-muted">{asset.percentage.toFixed(0)}%</span>
        </span>
      ))}
      {distribution.length > 3 && (
        <span className="text-xs text-text-muted">+{distribution.length - 3}</span>
      )}
    </div>
  );
}

// Change count badge renderer
export function ChangeCountRenderer(params: ICellRendererParams) {
  const data = params.data;
  if (!data) return null;
  return <ChangeCountBadge vaultAddress={data.address} />;
}

// Risk badge renderer
export function RiskBadgeRenderer() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background-elevated">
      <span className="text-xs font-medium text-text-muted">In Progress</span>
    </div>
  );
}

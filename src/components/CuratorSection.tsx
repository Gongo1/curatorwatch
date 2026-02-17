"use client";

import Link from "next/link";
import type { VaultCurator } from "@/lib/types/api";
import { formatCurrency, formatPercentage, formatTimeAgo } from "@/lib/utils/format";
import { CuratorAvatar, CuratorAvatarFallback } from "@/components/CuratorAvatar";

interface CuratorSectionProps {
  curator: VaultCurator;
}

export function CuratorSection({ curator }: CuratorSectionProps) {
  const getSentimentColor = (sentiment: string | null) => {
    switch (sentiment) {
      case "positive":
        return "text-accent-green";
      case "negative":
        return "text-accent-red";
      default:
        return "text-accent-blue";
    }
  };

  const getCategoryIcon = (category: string | null) => {
    switch (category) {
      case "partnership":
        return (
          <div className="w-8 h-8 rounded-lg bg-accent-green/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        );
      case "audit":
        return (
          <div className="w-8 h-8 rounded-lg bg-accent-green/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        );
      case "incident":
        return (
          <div className="w-8 h-8 rounded-lg bg-accent-red/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-accent-blue/15 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <section className="bg-background-subtle rounded-lg border border-border">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CuratorAvatar
              address={curator.address}
              name={curator.name}
              logoUrl={curator.logoUrl}
              size="md"
            />
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                {curator.name || "Unknown Curator"}
              </h2>
              <p className="text-sm text-text-tertiary">
                {curator.entityType && <span>{curator.entityType}</span>}
                {curator.entityType && curator.headquarters && <span> • </span>}
                {curator.headquarters && <span>{curator.headquarters}</span>}
                {curator.foundedYear && <span> • Est. {curator.foundedYear}</span>}
              </p>
            </div>
          </div>

          {/* Social links */}
          <div className="flex items-center gap-2">
            {curator.website && (
              <a
                href={curator.website}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-background-elevated hover:bg-background-hover transition-colors"
                title="Website"
              >
                <svg className="w-4 h-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </a>
            )}
            {curator.twitter && (
              <a
                href={`https://x.com/${curator.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-background-elevated hover:bg-background-hover transition-colors"
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
                className="p-2 rounded-lg bg-background-elevated hover:bg-background-hover transition-colors"
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

      {/* Description */}
      {curator.description && (
        <div className="px-6 py-4 border-b border-border">
          <p className="text-sm text-text-secondary leading-relaxed">
            {curator.description}
          </p>
        </div>
      )}

      {/* Stats & Compliance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-b border-border">
        {/* Regulatory & Compliance */}
        <div className="px-6 py-4 md:border-r border-b md:border-b-0 border-border">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
            Regulatory & Compliance
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Regulated</dt>
              <dd className={`font-medium ${curator.isRegulated ? "text-accent-green" : "text-text-muted"}`}>
                {curator.isRegulated ? "Yes" : "No"}
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
              <dd className="font-medium text-text-primary">
                {curator.jurisdiction || "Not specified"}
              </dd>
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
          </dl>
        </div>

        {/* Track Record */}
        <div className="px-6 py-4">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
            Curator Track Record
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Total Assets Managed</dt>
              <dd className="font-semibold text-text-primary tabular-nums">
                {formatCurrency(curator.totalAssetsManaged)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-tertiary">Vaults Managed</dt>
              <dd className="font-medium text-text-primary tabular-nums">
                {curator.vaultCount}
              </dd>
            </div>
            {curator.teamSize && (
              <div className="flex justify-between">
                <dt className="text-text-tertiary">Team Size</dt>
                <dd className="font-medium text-text-primary">{curator.teamSize}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Other Vaults */}
      {curator.otherVaults.length > 0 && (
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
            Other Vaults by {curator.name || "This Curator"}
          </h3>
          <div className="space-y-2">
            {curator.otherVaults.slice(0, 5).map((vault) => (
              <Link
                key={vault.id}
                href={`/vault/${vault.address}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-background-elevated hover:bg-background-hover transition-colors group"
              >
                <div>
                  <span className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
                    {vault.name}
                  </span>
                  <span className="text-xs text-text-muted ml-2">{vault.symbol}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-text-secondary tabular-nums">
                    {formatCurrency(vault.totalAssetsUsd)}
                  </span>
                  {vault.avgNetApy !== null && (
                    <span className="text-accent-green tabular-nums">
                      {formatPercentage(vault.avgNetApy)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
            {curator.otherVaults.length > 5 && (
              <Link
                href={`/curator/${curator.address}`}
                className="block text-center py-2 text-sm text-accent-blue hover:text-accent-blue-hover transition-colors"
              >
                View all {curator.vaultCount} vaults →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recent News */}
      {curator.news.length > 0 && (
        <div className="px-6 py-4">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
            Recent News & Activity
          </h3>
          <div className="space-y-3">
            {curator.news.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 group"
              >
                {getCategoryIcon(item.category)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium uppercase ${getSentimentColor(item.sentiment)}`}>
                      {item.category || "Update"}
                    </span>
                    <span className="text-xs text-text-muted">•</span>
                    <span className="text-xs text-text-muted">
                      {formatTimeAgo(item.publishedAt)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors mt-0.5">
                    {item.title}
                  </p>
                  {item.summary && (
                    <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">
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
          {curator.news.length > 3 && (
            <Link
              href={`/curator/${curator.address}`}
              className="block text-center pt-3 text-sm text-accent-blue hover:text-accent-blue-hover transition-colors"
            >
              View all news →
            </Link>
          )}
        </div>
      )}

      {/* No data state */}
      {!curator.description && curator.news.length === 0 && curator.otherVaults.length === 0 && (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-text-tertiary">
            Limited information available for this curator.
          </p>
          <p className="text-xs text-text-muted mt-1">
            Profile data will be updated as more information becomes available.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Placeholder component when no curator data is available
 */
export function CuratorPlaceholder({ curatorAddress }: { curatorAddress: string | null }) {
  if (!curatorAddress) {
    return (
      <section className="bg-background-subtle rounded-lg border border-border px-6 py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-background-elevated flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-text-primary mt-4">No Curator Assigned</p>
        <p className="text-xs text-text-tertiary mt-1">
          This vault does not have a designated curator.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-background-subtle rounded-lg border border-border px-6 py-4">
      <div className="flex items-center gap-3">
        <CuratorAvatarFallback
          address={curatorAddress}
          name={null}
          size="md"
        />
        <div>
          <h2 className="text-base font-semibold text-text-primary">Unknown Curator</h2>
          <p className="text-sm text-text-tertiary font-mono">
            {curatorAddress.slice(0, 6)}...{curatorAddress.slice(-4)}
          </p>
        </div>
      </div>
      <p className="text-sm text-text-secondary mt-4">
        No profile information available for this curator. The curator address is listed but no verified profile data has been collected yet.
      </p>
    </section>
  );
}

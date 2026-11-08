"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { VaultCurator } from "@/lib/types/api";
import { formatCurrency, formatPercentage, formatTimeAgo } from "@/lib/utils/format";
import { CuratorAvatar, CuratorAvatarFallback } from "@/components/CuratorAvatar";
import { curatorSlug } from "@/lib/curator-aliases";
import { Panel } from "@/components/layout/Panel";

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
        return "text-text-secondary";
    }
  };

  const socialClass =
    "inline-flex items-center justify-center w-6 h-6 border border-border-strong text-text-tertiary hover:text-accent-blue hover:border-accent-blue transition-colors";
  const profileHref = `/curator/${curatorSlug(curator.name, curator.address)}`;

  const socials = (curator.website || curator.twitter || curator.discord) && (
    <span className="flex items-center gap-1">
      {curator.website && (
        <a href={curator.website} target="_blank" rel="noopener noreferrer" className={socialClass} title="Website" aria-label="Website">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </a>
      )}
      {curator.twitter && (
        <a href={`https://x.com/${curator.twitter}`} target="_blank" rel="noopener noreferrer" className={socialClass} title="Twitter/X" aria-label="Twitter/X">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      )}
      {curator.discord && (
        <a href={curator.discord} target="_blank" rel="noopener noreferrer" className={socialClass} title="Discord" aria-label="Discord">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
          </svg>
        </a>
      )}
    </span>
  );

  const row = "flex justify-between gap-3 h-7 items-center border-b border-border-subtle last:border-b-0";

  return (
    <Panel title="Curator" action={socials || undefined}>
      {/* Identity */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border">
        <CuratorAvatar
          address={curator.address}
          name={curator.name}
          logoUrl={curator.logoUrl}
          size="sm"
        />
        <div className="min-w-0">
          <Link href={profileHref} className="cond font-bold text-[1.05rem] leading-tight text-text-primary hover:text-accent-blue">
            {curator.name || "Unknown curator"}
          </Link>
          <p className="text-xs text-text-tertiary truncate">
            {curator.entityType && <span>{curator.entityType}</span>}
            {curator.entityType && curator.headquarters && <span> · </span>}
            {curator.headquarters && <span>{curator.headquarters}</span>}
            {curator.foundedYear && <span> · Est. <span className="num">{curator.foundedYear}</span></span>}
          </p>
        </div>
      </div>

      {/* Description */}
      {curator.description && (
        <p className="px-3 py-2.5 border-b border-border text-sm text-text-secondary leading-relaxed max-w-[90ch]">
          {curator.description}
        </p>
      )}

      {/* Stats & Compliance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border">
        {/* Regulatory & Compliance */}
        <div className="px-3 py-2.5 md:border-r border-b md:border-b-0 border-border">
          <h3 className="label mb-1">Regulatory & compliance</h3>
          <dl className="text-sm">
            <div className={row}>
              <dt className="text-text-tertiary">Regulated</dt>
              <dd className={`font-medium ${curator.isRegulated ? "text-accent-green" : "text-text-muted"}`}>
                {curator.isRegulated ? "Yes" : "No"}
              </dd>
            </div>
            {curator.regulatoryBody && (
              <div className={row}>
                <dt className="text-text-tertiary">Regulatory body</dt>
                <dd className="font-medium text-text-primary text-right truncate">{curator.regulatoryBody}</dd>
              </div>
            )}
            <div className={row}>
              <dt className="text-text-tertiary">Jurisdiction</dt>
              <dd className="font-medium text-text-primary text-right truncate">
                {curator.jurisdiction || "Not specified"}
              </dd>
            </div>
            {curator.entityType && (
              <div className={row}>
                <dt className="text-text-tertiary">Entity type</dt>
                <dd className="font-medium text-text-primary text-right truncate">
                  {curator.entityType}
                  {curator.registeredState && ` (${curator.registeredState})`}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Track Record */}
        <div className="px-3 py-2.5">
          <h3 className="label mb-1">Curator track record</h3>
          <dl className="text-sm">
            <div className={row}>
              <dt className="text-text-tertiary">Total assets managed</dt>
              <dd className="num font-semibold text-text-primary">
                {formatCurrency(curator.totalAssetsManaged)}
              </dd>
            </div>
            <div className={row}>
              <dt className="text-text-tertiary">Vaults managed</dt>
              <dd className="num text-text-primary">{curator.vaultCount}</dd>
            </div>
            {curator.teamSize && (
              <div className={row}>
                <dt className="text-text-tertiary">Team size</dt>
                <dd className="num text-text-primary">{curator.teamSize}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Other Vaults */}
      {curator.otherVaults.length > 0 && (
        <div className="border-b border-border">
          <h3 className="label px-3 pt-2.5 pb-1">Other vaults by {curator.name || "this curator"}</h3>
          <ul>
            {curator.otherVaults.slice(0, 5).map((vault) => (
              <li key={vault.id}>
                <Link
                  href={`/vault/${vault.address}`}
                  className="flex items-center justify-between gap-3 h-8 px-3 border-t border-border-subtle hover:bg-background-hover transition-colors group"
                >
                  <span className="flex items-baseline gap-2 min-w-0">
                    <span className="text-sm font-medium text-text-primary group-hover:text-accent-blue truncate">
                      {vault.name}
                    </span>
                    <span className="label hidden sm:inline">{vault.symbol}</span>
                  </span>
                  <span className="flex items-center gap-4 text-sm flex-none">
                    <span className="num text-text-secondary">{formatCurrency(vault.totalAssetsUsd)}</span>
                    {vault.avgNetApy !== null && (
                      <span className="num text-text-primary w-16 text-right">{formatPercentage(vault.avgNetApy)}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {curator.otherVaults.length > 5 && (
            <Link
              href={profileHref}
              className="flex items-center justify-center h-8 border-t border-border-subtle label text-accent-blue hover:bg-background-hover transition-colors"
            >
              View all {curator.vaultCount} vaults <ArrowRight className="inline w-3.5 h-3.5 align-[-2px]" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {/* Recent News */}
      {curator.news.length > 0 && (
        <div>
          <h3 className="label px-3 pt-2.5 pb-1">Recent news & activity</h3>
          <ul>
            {curator.news.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 px-3 py-2 border-t border-border-subtle hover:bg-background-hover transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`label ${getSentimentColor(item.sentiment)}`}>
                        {item.category || "Update"}
                      </span>
                      <span className="num text-xs text-text-muted">{formatTimeAgo(item.publishedAt)}</span>
                    </div>
                    <p className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors mt-0.5">
                      {item.title}
                    </p>
                    {item.summary && (
                      <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">{item.summary}</p>
                    )}
                  </div>
                  <svg className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-blue transition-colors flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
          {curator.news.length > 3 && (
            <Link
              href={profileHref}
              className="flex items-center justify-center h-8 border-t border-border-subtle label text-accent-blue hover:bg-background-hover transition-colors"
            >
              View all news <ArrowRight className="inline w-3.5 h-3.5 align-[-2px]" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {/* No data state */}
      {!curator.description && curator.news.length === 0 && curator.otherVaults.length === 0 && (
        <p className="px-3 py-2.5 text-sm text-text-tertiary">
          Limited profile data for this curator so far. It fills in as sources are collected.
        </p>
      )}
    </Panel>
  );
}

/**
 * Placeholder component when no curator data is available
 */
export function CuratorPlaceholder({ curatorAddress }: { curatorAddress: string | null }) {
  if (!curatorAddress) {
    return (
      <Panel title="Curator" bodyClassName="p-3">
        <p className="text-sm text-text-primary">No curator assigned</p>
        <p className="text-xs text-text-tertiary mt-0.5">This vault does not have a designated curator.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Curator" bodyClassName="p-3">
      <div className="flex items-center gap-3">
        <CuratorAvatarFallback address={curatorAddress} name={null} size="sm" />
        <div>
          <p className="cond font-bold text-[1.05rem] leading-tight text-text-primary">Unknown curator</p>
          <p className="num text-xs text-text-tertiary">
            {curatorAddress.slice(0, 6)}...{curatorAddress.slice(-4)}
          </p>
        </div>
      </div>
      <p className="text-sm text-text-secondary mt-2.5">
        No profile information available for this curator. The curator address is listed but no verified profile data has been collected yet.
      </p>
    </Panel>
  );
}

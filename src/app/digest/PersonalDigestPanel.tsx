"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePortfolio } from "@/hooks/usePortfolio";
import { personalizeDigest } from "@/lib/digest/personalize";
import type { DigestData } from "@/lib/digest/types";
import { Panel } from "@/components/layout/Panel";

function usd(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
}
const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/**
 * Client island: a personalized read of today's digest from the device-local
 * watchlist (usePortfolio / localStorage). The full delivered edition (every
 * watched curator, regardless of rank) ships with accounts — see
 * docs/personalized-digest-v2.md.
 */
export function PersonalDigestPanel({ data }: { data: DigestData }) {
  const { portfolio } = usePortfolio();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const personal = useMemo(
    () =>
      personalizeDigest(data, {
        curatorIds: new Set(portfolio.trackedCurators.map((c) => c.id)),
        curatorNames: new Set(portfolio.trackedCurators.map((c) => c.name)),
      }),
    [data, portfolio.trackedCurators]
  );

  // Avoid SSR/CSR hydration mismatch — localStorage is client-only.
  if (!mounted) return null;

  const watchedCount = portfolio.trackedCurators.length;

  return (
    <Panel title="Your watchlist" meta={`${watchedCount} tracked · this device`}>
      {watchedCount === 0 ? (
        <p className="px-3 py-2.5 text-sm text-text-secondary leading-relaxed max-w-[70ch]">
          Track curators (the Track button on any profile) for a personalized read of each
          day&rsquo;s digest. The full delivered edition (every watched curator, emailed) ships
          with accounts.
        </p>
      ) : personal.hasMatches ? (
        <ul>
          {[...personal.inflows, ...personal.outflows].map((f) => (
            <li key={f.curatorId}>
              <Link
                href={`/curator/${f.slug}`}
                className="flex items-center justify-between gap-3 px-3 h-8 border-b border-border-subtle hover:bg-background-hover transition-colors group"
              >
                <span className="truncate text-sm text-text-primary group-hover:text-accent-blue">{f.name ?? "—"}</span>
                <span className={`num text-sm whitespace-nowrap ${f.deltaUsd >= 0 ? "up" : "down"}`}>
                  {usd(f.deltaUsd)} <span className="text-xs">({signedPct(f.pct)})</span>
                </span>
              </Link>
            </li>
          ))}
          {personal.concentration.map((c) => (
            <li key={c.symbol} className="flex items-center gap-2 px-3 h-8 border-b border-border-subtle text-sm text-text-secondary">
              <span className="text-accent-yellow" aria-hidden="true">⚠</span>
              <span className="truncate">
                {c.topCurator} runs <span className="num text-accent-yellow">{Math.round(c.topCuratorPct)}%</span> of {c.symbol}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-2.5 text-sm text-text-secondary leading-relaxed max-w-[70ch]">
          None of your {watchedCount} tracked curator{watchedCount === 1 ? "" : "s"} moved into
          today&rsquo;s top movers. The full personalized edition (every watched curator) ships with
          accounts.
        </p>
      )}
    </Panel>
  );
}

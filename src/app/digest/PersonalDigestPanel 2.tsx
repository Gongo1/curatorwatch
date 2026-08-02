"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePortfolio } from "@/hooks/usePortfolio";
import { personalizeDigest } from "@/lib/digest/personalize";
import type { DigestData } from "@/lib/digest/types";

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
    <section className="mt-6 rounded-2xl border border-accent-blue/30 bg-accent-blue/5 p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <span className="font-display font-bold text-base">Your watchlist</span>
        <span className="font-mono text-[11px] text-text-tertiary">
          {watchedCount} tracked · this device
        </span>
      </div>

      {watchedCount === 0 ? (
        <p className="text-sm text-text-secondary">
          Track curators (the Track button on any profile) for a personalized read of each
          day&rsquo;s digest. The full delivered edition — every watched curator, emailed — ships
          with accounts.
        </p>
      ) : personal.hasMatches ? (
        <div className="space-y-2 font-mono text-sm">
          {[...personal.inflows, ...personal.outflows].map((f) => (
            <Link
              key={f.curatorId}
              href={`/curator/${f.slug}`}
              className="flex justify-between gap-3 text-text-secondary hover:text-accent-blue transition-colors"
            >
              <span className="truncate">{f.name ?? "—"}</span>
              <span className={`tabular-nums whitespace-nowrap ${f.deltaUsd >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                {usd(f.deltaUsd)} ({signedPct(f.pct)})
              </span>
            </Link>
          ))}
          {personal.concentration.map((c) => (
            <div key={c.symbol} className="text-text-secondary">
              <span className="text-accent-yellow">⚠</span> {c.topCurator} runs {Math.round(c.topCuratorPct)}% of {c.symbol}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-secondary">
          None of your {watchedCount} tracked curator{watchedCount === 1 ? "" : "s"} moved into
          today&rsquo;s top movers. The full personalized edition (every watched curator) ships with
          accounts.
        </p>
      )}
    </section>
  );
}

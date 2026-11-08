"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ArrowDown, ArrowUp } from "lucide-react";
import type { CuratorDashboardItem } from "@/lib/types/api";
import { formatCurrency } from "@/lib/utils/format";
import { curatorSlug } from "@/lib/curator-aliases";
import { hasCuratorDisclosure } from "@/lib/curator-disclosures";
import { DisclosureFlag } from "@/components/DisclosureFlag";
import { useGate } from "@/lib/gate/GateProvider";
import { GateTableOverlay } from "@/components/gate/GateTableOverlay";
import type { RankingGateMeta } from "@/lib/gate/config";
import { RANKING_COLS } from "./ranking-cols";

function initials(name: string): string {
  return name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

type SortKey = "name" | "vaults" | "stable" | "apy" | "tvl";
type SrcFilter = "all" | "regulated" | "stable";

// A curator counts as "stablecoin-focused" when >= this share of its AUM is in
// stablecoins (per the canonical classifier). Captures the monoline/niche-house
// archetypes from the stablecoin-landscape research; tunable.
const STABLE_FOCUS_THRESHOLD = 90;

const CHIPS: { key: SrcFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "stable", label: "Stablecoin focus" },
  { key: "regulated", label: "Has jurisdiction" },
];

const PAGE = 25;

function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

function Th({
  k,
  children,
  className = "",
  title,
  sortKey,
  sortDir,
  truncated,
  onSort,
}: {
  k: SortKey;
  children: React.ReactNode;
  className?: string;
  title?: string;
  sortKey: SortKey;
  sortDir: 1 | -1;
  truncated: boolean;
  onSort: (k: SortKey) => void;
}) {
  const activeKey = sortKey === k;
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      aria-pressed={activeKey}
      title={truncated ? "Sort the full ranking — free account" : title}
      className={`label hover:text-text-primary transition-colors ${activeKey ? "text-accent-blue" : ""} ${className}`}
    >
      {children}
      <span className="inline-flex w-3 justify-center align-[-2px]" aria-hidden="true">
        {activeKey && (sortDir < 0 ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
      </span>
    </button>
  );
}

export function CuratorIndex({
  curators,
  gate = null,
  totalAUM,
}: {
  curators: CuratorDashboardItem[];
  gate?: RankingGateMeta | null;
  /** Tracked TVL across all curators — the "share" column's denominator. */
  totalAUM?: number;
}) {
  const [query, setQuery] = useState("");
  const [filterSrc, setFilterSrc] = useState<SrcFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("tvl");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [limit, setLimit] = useState(PAGE);
  const { ready, isSignedIn, openGate } = useGate();

  // Data-driven gating: the payload itself says whether it was truncated. The
  // overlay renders only once auth state is known AND the viewer is anonymous —
  // signed-in visitors on the ISR shell see plain rows while the full list
  // upgrade-fetches (no locked-flash, per the gating spec).
  const truncated = !!gate?.truncated;
  const locked = truncated && ready && !isSignedIn;
  const denom = totalAUM ?? curators.reduce((s, c) => s + c.totalAUM, 0);

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = curators.filter((c) => {
      if (q && !(c.name || "").toLowerCase().includes(q)) return false;
      if (filterSrc === "regulated") return !!c.jurisdiction;
      if (filterSrc === "stable") return c.stablePct >= STABLE_FOCUS_THRESHOLD;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sortKey === "name") {
        const an = (a.name || "").toLowerCase();
        const bn = (b.name || "").toLowerCase();
        return an < bn ? -sortDir : an > bn ? sortDir : 0;
      }
      const score = (c: CuratorDashboardItem) =>
        sortKey === "vaults"
          ? c.vaultCount
          : sortKey === "stable"
            ? c.stablePct
            : sortKey === "apy"
              ? c.avgNetApy
              : c.totalAUM;
      return (score(a) - score(b)) * sortDir;
    });
  }, [curators, query, filterSrc, sortKey, sortDir]);

  const onSort = (k: SortKey) => {
    if (truncated) {
      openGate("tools");
      return;
    }
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? 1 : -1);
    }
    setLimit(PAGE);
  };

  const shown = rows.slice(0, limit);

  return (
    <div>
      {/* toolbar */}
      <div className="flex gap-2 items-center px-2 py-1.5 border-b border-border flex-wrap">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            aria-label="Filter curators by name"
            value={query}
            readOnly={truncated}
            onFocus={truncated ? () => openGate("tools") : undefined}
            onClick={truncated ? () => openGate("tools") : undefined}
            onChange={(e) => {
              if (truncated) return;
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={`Filter ${gate?.totalCount ?? curators.length} curators`}
            autoComplete="off"
            className="field h-7 pl-7 text-sm"
          />
        </div>
        <div role="group" aria-label="Focus" className="flex border border-border-strong">
          {CHIPS.map((ch) => (
            <button
              key={ch.key}
              type="button"
              aria-pressed={filterSrc === ch.key}
              onClick={() => {
                if (truncated) {
                  openGate("tools");
                  return;
                }
                setFilterSrc(ch.key);
                setLimit(PAGE);
              }}
              className={`h-[1.625rem] px-2.5 cond text-[0.75rem] font-semibold uppercase tracking-[0.04em] border-r border-border-strong last:border-r-0 transition-colors ${
                filterSrc === ch.key
                  ? "bg-accent-blue text-signal-ink"
                  : "text-text-secondary hover:text-text-primary hover:bg-background-hover"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* column header */}
      <div className={`${RANKING_COLS} gap-3 px-3 h-7 items-center border-b border-border bg-background`}>
        <span className="label text-right">#</span>
        <Th sortKey={sortKey} sortDir={sortDir} truncated={truncated} onSort={onSort} k="name" className="text-left">Curator</Th>
        <Th sortKey={sortKey} sortDir={sortDir} truncated={truncated} onSort={onSort} k="vaults" className="text-right hidden md:block">Vaults</Th>
        <Th sortKey={sortKey} sortDir={sortDir} truncated={truncated} onSort={onSort} k="stable" className="text-right hidden xl:block" title="Stablecoin share of the curator's TVL">Stable</Th>
        <Th sortKey={sortKey} sortDir={sortDir} truncated={truncated} onSort={onSort} k="apy" className="text-right hidden sm:block" title="TVL-weighted net APY">Net APY</Th>
        <span className="label text-right hidden xl:block" title="Share of tracked TVL">Share</span>
        <Th sortKey={sortKey} sortDir={sortDir} truncated={truncated} onSort={onSort} k="tvl" className="text-right">TVL</Th>
      </div>

      {/* rows */}
      {shown.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-10">
          No curator matches “{query}”. Clear the filter to see all {curators.length}.
        </p>
      ) : (
        <ol>
          {shown.map((c, i) => {
            const name = c.name || `Curator ${c.curatorAddress.slice(0, 6)}`;
            return (
              <li key={c.curatorId}>
                <Link
                  href={`/curator/${curatorSlug(c.name, c.curatorAddress)}`}
                  className={`${RANKING_COLS} gap-3 items-center px-3 h-[1.875rem] border-b border-border-subtle hover:bg-background-hover focus-visible:bg-background-hover transition-colors duration-100 group`}
                >
                  <span className="num text-xs text-text-tertiary text-right">{i + 1}</span>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="relative w-5 h-5 flex-none bg-background-elevated grid place-items-center overflow-hidden cond font-bold text-[0.6rem] text-accent-blue">
                      {initials(name)}
                      {c.logoUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={c.logoUrl}
                          alt=""
                          width={20}
                          height={20}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                    </span>
                    <span className="text-[0.9rem] font-medium text-text-primary group-hover:text-accent-blue truncate">
                      {name}
                    </span>
                    {hasCuratorDisclosure(c.curatorAddress) && <DisclosureFlag />}
                    {c.jurisdiction && (
                      <span className="hidden lg:inline label truncate">{c.jurisdiction}</span>
                    )}
                  </span>
                  <span className="hidden md:block num text-sm text-text-secondary text-right">{c.vaultCount}</span>
                  <span className="hidden xl:block num text-sm text-text-secondary text-right">{pct(c.stablePct, 0)}</span>
                  <span className="hidden sm:block num text-sm text-text-primary text-right">
                    {c.avgNetApy > 0 ? pct(c.avgNetApy * 100, 2) : "—"}
                  </span>
                  <span className="hidden xl:block num text-xs text-text-tertiary text-right">
                    {denom > 0 ? pct((c.totalAUM / denom) * 100) : "—"}
                  </span>
                  <span className="num text-[0.95rem] font-semibold text-text-primary text-right">
                    {formatCurrency(c.totalAUM)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {/* Locked continuation: decoy rows + sign-up panel (anonymous, truncated payloads only) */}
      {locked && gate && (
        <GateTableOverlay
          totalCount={gate.totalCount}
          teaseNames={(gate.teaseNames ?? []).filter((n): n is string => !!n)}
        />
      )}

      {!truncated && rows.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + 25)}
          className="block w-full h-8 label text-accent-blue hover:bg-background-hover transition-colors"
        >
          Show {Math.min(25, rows.length - limit)} more · {limit} of {rows.length}
        </button>
      )}
    </div>
  );
}

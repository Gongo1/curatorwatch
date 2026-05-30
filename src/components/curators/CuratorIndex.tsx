"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { CuratorDashboardItem } from "@/lib/types/api";
import { curatorSlug } from "@/lib/curator-aliases";
import { formatCurrency } from "@/lib/utils/format";

function initials(name: string): string {
  return name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const srcLabel = (s: string) => (s === "turtle" ? "Turtle" : "Morpho");

type SortKey = "name" | "grade" | "vaults" | "tvl";
type SrcFilter = "all" | "morpho" | "turtle" | "regulated";

const CHIPS: { key: SrcFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "morpho", label: "Morpho" },
  { key: "turtle", label: "Turtle" },
  { key: "regulated", label: "Has jurisdiction" },
];

const PAGE = 15;

export function CuratorIndex({ curators }: { curators: CuratorDashboardItem[] }) {
  const [query, setQuery] = useState("");
  const [filterSrc, setFilterSrc] = useState<SrcFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("tvl");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [limit, setLimit] = useState(PAGE);

  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = curators.filter((c) => {
      if (q && !(c.name || "").toLowerCase().includes(q)) return false;
      if (filterSrc === "morpho" || filterSrc === "turtle")
        return c.dataSources.includes(filterSrc);
      if (filterSrc === "regulated") return !!c.jurisdiction;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sortKey === "name") {
        const an = (a.name || "").toLowerCase();
        const bn = (b.name || "").toLowerCase();
        return an < bn ? -sortDir : an > bn ? sortDir : 0;
      }
      const score = (c: CuratorDashboardItem) =>
        sortKey === "grade"
          ? c.gradeDistribution.high * 2 + c.gradeDistribution.medium
          : sortKey === "vaults"
            ? c.vaultCount
            : c.totalAUM;
      return (score(a) - score(b)) * sortDir;
    });
  }, [curators, query, filterSrc, sortKey, sortDir]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? 1 : -1);
    }
    setLimit(PAGE);
  };

  const shown = rows.slice(0, limit);
  const arrow = sortDir < 0 ? " ↓" : " ↑";

  const Th = ({
    k,
    children,
    className = "",
  }: {
    k: SortKey;
    children: React.ReactNode;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={() => onSort(k)}
      aria-sort={sortKey === k ? (sortDir < 0 ? "descending" : "ascending") : "none"}
      className={`font-mono text-[10px] uppercase tracking-[0.1em] hover:text-text-primary transition-colors ${
        sortKey === k ? "text-accent-blue" : "text-text-tertiary"
      } ${className}`}
    >
      {children}
      {sortKey === k ? arrow : ""}
    </button>
  );

  return (
    <div>
      {/* controls */}
      <div className="flex gap-3 items-center mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={`Search ${curators.length} curators by name…`}
            autoComplete="off"
            className="w-full bg-background-subtle border border-border rounded-[10px] py-2.5 pl-[2.375rem] pr-3.5 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline focus-visible:outline-accent-blue focus-visible:outline-offset-1 focus:border-accent-blue transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CHIPS.map((ch) => (
            <button
              key={ch.key}
              type="button"
              onClick={() => {
                setFilterSrc(ch.key);
                setLimit(PAGE);
              }}
              className={`font-mono text-xs rounded-lg px-3 py-2 border transition-colors active:translate-y-px ${
                filterSrc === ch.key
                  ? "text-accent-blue border-accent-blue bg-accent-blue/10"
                  : "text-text-secondary border-border bg-background-subtle hover:text-text-primary"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* column header */}
      <div className="grid grid-cols-[34px_1fr_150px_96px_132px] gap-4 px-3 pb-3 items-center">
        <span aria-hidden="true" />
        <Th k="name" className="text-left">Curator</Th>
        <Th k="grade" className="text-left hidden sm:block">Vault grades</Th>
        <Th k="vaults" className="text-right hidden sm:block">Vaults</Th>
        <Th k="tvl" className="text-right">TVL</Th>
      </div>

      {/* rows */}
      {shown.length === 0 ? (
        <p className="font-mono text-sm text-text-tertiary text-center py-12 border-t border-border-subtle">
          No curators match “{query}”.
        </p>
      ) : (
        shown.map((c, i) => {
          const g = c.gradeDistribution;
          const graded = g.high + g.medium + g.low || 1;
          const name = c.name || `Curator ${c.curatorAddress.slice(0, 6)}`;
          return (
            <Link
              key={c.curatorId}
              href={`/curator/${curatorSlug(c.name, c.curatorAddress)}`}
              className="grid grid-cols-[34px_1fr_150px_96px_132px] gap-4 items-center px-3 py-3 border-t border-border-subtle hover:bg-background-subtle active:translate-y-px transition-colors group"
            >
              <span className="font-mono text-sm text-text-tertiary text-right tabular-nums">
                {i + 1}
              </span>
              <div className="flex items-center gap-3 min-w-0">
                <span className="relative w-9 h-9 rounded-[9px] flex-none bg-background-elevated border border-border grid place-items-center overflow-hidden font-display font-bold text-xs text-accent-blue">
                  {initials(name)}
                  {c.logoUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.logoUrl}
                      alt=""
                      width={36}
                      height={36}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors truncate">
                    {name}
                  </div>
                  <div className="font-mono text-xs text-text-tertiary mt-0.5 flex items-center gap-2 flex-wrap min-w-0">
                    {c.jurisdiction && <span>{c.jurisdiction}</span>}
                    {c.dataSources.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] text-text-secondary border border-border rounded px-1.5"
                      >
                        {srcLabel(s)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {/* grade mix */}
              <div className="hidden sm:flex flex-col gap-1.5">
                <div className="h-1.5 rounded-[3px] overflow-hidden flex bg-background-elevated">
                  {g.high > 0 && (
                    <span className="bg-accent-green h-full" style={{ width: `${(g.high / graded) * 100}%` }} />
                  )}
                  {g.medium > 0 && (
                    <span className="bg-accent-yellow h-full" style={{ width: `${(g.medium / graded) * 100}%` }} />
                  )}
                  {g.low > 0 && (
                    <span className="bg-accent-red h-full" style={{ width: `${(g.low / graded) * 100}%` }} />
                  )}
                </div>
                <div className="font-mono text-[10px] text-text-tertiary tabular-nums">
                  {[
                    g.high ? `${g.high}H` : "",
                    g.medium ? `${g.medium}M` : "",
                    g.low ? `${g.low}L` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
              <span className="hidden sm:block font-mono text-sm text-text-secondary text-right tabular-nums">
                {c.vaultCount}
              </span>
              <span className="font-mono text-base font-semibold text-text-primary text-right tabular-nums tracking-tight">
                {formatCurrency(c.totalAUM)}
              </span>
            </Link>
          );
        })
      )}

      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + 20)}
          className="block w-full mt-5 text-center font-mono text-xs text-accent-blue bg-transparent border border-border rounded-[9px] py-2.5 hover:border-accent-blue active:translate-y-px transition-colors"
        >
          Show {Math.min(20, rows.length - limit)} more — {limit} of {rows.length} →
        </button>
      )}
    </div>
  );
}

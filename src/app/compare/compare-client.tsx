"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { curatorSlug } from "@/lib/curator-aliases";
import { hasCuratorDisclosure } from "@/lib/curator-disclosures";
import { DisclosureFlag } from "@/components/DisclosureFlag";
import type { CuratorDashboardItem, CompareVaultItem } from "@/lib/types/api";
import { COMPARE_PRESETS } from "@/lib/compare-presets";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";

const MAX_COMPARE = 4;

/** min / median / max of the real per-vault net APYs (percent), ignoring unknowns. */
function apySpread(vaults: CompareVaultItem[]): { min: number; med: number; max: number; n: number } | null {
  const xs = vaults
    .map((v) => v.netApyPct)
    .filter((x): x is number => x != null)
    .sort((a, b) => a - b);
  if (!xs.length) return null;
  return { min: xs[0], med: xs[Math.floor((xs.length - 1) / 2)], max: xs[xs.length - 1], n: xs.length };
}

function compactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

export function CompareClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [curators, setCurators] = useState<CuratorDashboardItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard?page=1&pageSize=100&sortBy=aum&sortOrder=desc");
        const json = await res.json();
        if (cancelled) return;
        if (!json.curators?.success) throw new Error("Failed to load curators");
        setCurators(json.curators.data.curators);
      } catch {
        if (!cancelled) setError("Could not load curator data. Reload the page to try again.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAddresses = useMemo(
    () =>
      (searchParams.get("c") || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, MAX_COMPARE),
    [searchParams]
  );

  const byAddress = useMemo(() => {
    const m = new Map<string, CuratorDashboardItem>();
    for (const c of curators) m.set(c.curatorAddress.toLowerCase(), c);
    return m;
  }, [curators]);

  const selected = selectedAddresses
    .map((a) => byAddress.get(a))
    .filter((c): c is CuratorDashboardItem => Boolean(c));

  const setSelection = (addresses: string[]) => {
    const qs = addresses.length ? `?c=${addresses.join(",")}` : "";
    router.replace(`/compare${qs}`, { scroll: false });
  };
  const addCurator = (address: string) => {
    const a = address.toLowerCase();
    if (selectedAddresses.includes(a) || selectedAddresses.length >= MAX_COMPARE) return;
    setSelection([...selectedAddresses, a]);
    setQuery("");
  };
  const removeCurator = (address: string) =>
    setSelection(selectedAddresses.filter((a) => a !== address.toLowerCase()));

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return curators
      .filter(
        (c) =>
          !selectedAddresses.includes(c.curatorAddress.toLowerCase()) &&
          (c.name || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, curators, selectedAddresses]);

  if (!loaded) return <div className="h-[60vh]" />;
  if (error) {
    return (
      <div className="space-y-1.5">
        <PageHeader title="Compare curators" />
        <div className="panel p-6 text-sm text-text-secondary text-center">{error}</div>
      </div>
    );
  }

  const full = selectedAddresses.length >= MAX_COMPARE;

  return (
    <div className="space-y-1.5">
      <PageHeader
        title="Compare curators"
        description={`Side by side on the dimensions allocators care about. Pick up to ${MAX_COMPARE}.`}
      />

      {/* ── Selection ── */}
      <Panel title="Selection" meta={`${selected.length} of ${MAX_COMPARE}`} className="relative z-10">
        <div className="flex gap-2 items-center flex-wrap px-2 py-1.5">
          <div className="relative flex-1 min-w-[14rem] max-w-[26rem]">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={full ? "Remove a curator to add another" : "Add a curator by name"}
              disabled={full}
              aria-label="Search curators to compare"
              autoComplete="off"
              className="field h-7 pl-7 text-sm disabled:opacity-50"
            />
            {candidates.length > 0 && (
              <ul className="absolute z-20 mt-px w-full bg-background-elevated border border-border-strong">
                {candidates.map((c) => (
                  <li key={c.curatorAddress}>
                    <button
                      type="button"
                      onClick={() => addCurator(c.curatorAddress)}
                      className="w-full h-8 flex items-center justify-between gap-3 px-2.5 text-left text-sm text-text-primary hover:bg-background-hover hover:text-accent-blue transition-colors"
                    >
                      <span className="truncate">{c.name || c.curatorAddress.slice(0, 10)}</span>
                      <span className="num text-xs text-text-tertiary">{compactUsd(c.totalAUM)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selected.map((c) => (
            <span
              key={c.curatorAddress}
              className="inline-flex items-center gap-2 h-7 pl-2.5 pr-1.5 border border-accent-blue text-sm text-text-primary"
            >
              <span className="truncate max-w-[12rem]">{c.name || c.curatorAddress.slice(0, 8)}</span>
              <button
                type="button"
                onClick={() => removeCurator(c.curatorAddress)}
                aria-label={`Remove ${c.name || "curator"} from comparison`}
                className="text-text-tertiary hover:text-accent-red transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>

        {/* preset packs */}
        <div className="flex gap-1.5 items-center flex-wrap px-2 py-1.5 border-t border-border-subtle">
          <span className="label mr-1">Packs</span>
          {COMPARE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              onClick={() => {
                const a = p.select(curators);
                if (a.length) setSelection(a);
              }}
              className="btn btn-ghost h-7 px-2.5 text-[0.75rem]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </Panel>

      {selected.length === 0 && (
        <Panel title="Nothing selected" bodyClassName="p-6 text-center">
          <Plus className="w-5 h-5 text-text-tertiary mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-text-secondary">
            Add curators above, pick a pack, or start from a profile&rsquo;s{" "}
            <span className="label text-text-secondary border border-border-strong px-1.5 py-0.5">Compare</span>{" "}
            action. Top curators by TVL:
          </p>
          <div className="flex gap-1.5 justify-center flex-wrap mt-3">
            {curators.slice(0, 5).map((c) => (
              <button
                key={c.curatorAddress}
                type="button"
                onClick={() => addCurator(c.curatorAddress)}
                className="btn btn-ghost h-7 px-2.5 text-[0.75rem]"
              >
                {c.name}
              </button>
            ))}
          </div>
        </Panel>
      )}

      {selected.length > 0 && (
        <Panel title="Side by side" meta="latest 6h snapshot · ▲ highest">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th scope="col" className="label text-left font-semibold px-3 py-2 w-[160px] align-bottom">
                    Dimension
                  </th>
                  {selected.map((c) => (
                    <th key={c.curatorAddress} scope="col" className="text-left px-3 py-2 align-bottom">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/curator/${curatorSlug(c.name, c.curatorAddress)}`}
                          className="cond font-bold text-[0.95rem] text-text-primary hover:text-accent-blue transition-colors truncate"
                        >
                          {c.name || c.curatorAddress.slice(0, 10)}
                        </Link>
                        {hasCuratorDisclosure(c.curatorAddress) && <DisclosureFlag />}
                      </div>
                      <div className="label normal-case tracking-normal font-normal mt-0.5">
                        {c.jurisdiction || "Jurisdiction unknown"}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label="AUM" cells={selected.map((c) => compactUsd(c.totalAUM))} highlight={best(selected.map((c) => c.totalAUM))} num />
                <Row label="Vaults" cells={selected.map((c) => String(c.vaultCount))} num />
                <Row
                  label="Net APY (TVL-wtd)"
                  cells={selected.map((c) => `${(c.avgNetApy * 100).toFixed(2)}%`)}
                  highlight={best(selected.map((c) => c.avgNetApy))}
                  num
                />
                <tr className="border-t border-border-subtle hover:bg-background-hover">
                  <th scope="row" className="label text-left font-semibold px-3 py-2 align-top">
                    Per-vault net APY
                  </th>
                  {selected.map((c) => {
                    const s = apySpread(c.vaults);
                    return (
                      <td key={c.curatorAddress} className="px-3 py-2 align-top text-text-primary">
                        {s ? (
                          <>
                            <span className="num">
                              {s.min.toFixed(1)}% · <span className="text-text-secondary">{s.med.toFixed(1)}%</span> · {s.max.toFixed(1)}%
                            </span>
                            <div className="text-[0.7rem] text-text-tertiary mt-0.5">
                              min · med · max across <span className="num">{s.n}</span> vault{s.n === 1 ? "" : "s"}
                            </div>
                          </>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <Row
                  label="Est. annual yield"
                  cells={selected.map((c) => formatCurrency(c.totalAUM * c.avgNetApy))}
                  num
                />
                <Row
                  label="Strategy"
                  cells={selected.map((c) => c.strategyType)}
                />
                <Row
                  label="Top assets"
                  cells={selected.map((c) =>
                    c.assetDistribution.slice(0, 3).map((a) => `${a.symbol} ${Math.round(a.percentage)}%`).join(" · ") || "—"
                  )}
                />
                <Row label="Networks" cells={selected.map((c) => c.networks.join(" · ") || "—")} />
                <Row label="Sources" cells={selected.map((c) => c.dataSources.join(" · ") || "—")} />
                <Row
                  label="Entity"
                  cells={selected.map((c) =>
                    [c.entityType, c.isRegulated ? "Regulated" : "Not regulated"].filter(Boolean).join(" · ")
                  )}
                />
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 border-t border-border-subtle text-xs text-text-tertiary">
            All figures from the latest 6h snapshot. Open a curator&rsquo;s profile for
            track record and the full change history.
          </p>
        </Panel>
      )}
    </div>
  );
}

function best(values: number[]): number {
  let idx = -1;
  let max = -Infinity;
  values.forEach((v, i) => {
    if (v > max) {
      max = v;
      idx = i;
    }
  });
  return values.length > 1 ? idx : -1;
}

function Row({
  label,
  cells,
  tones,
  highlight = -1,
  num = false,
}: {
  label: string;
  cells: string[];
  tones?: string[];
  highlight?: number;
  /** Figures: mono tabular. Text rows (strategy, networks…) stay in the sans face. */
  num?: boolean;
}) {
  return (
    <tr className="border-t border-border-subtle hover:bg-background-hover">
      <th scope="row" className="label text-left font-semibold px-3 py-2 align-top">{label}</th>
      {cells.map((v, i) => (
        <td
          key={i}
          className={`px-3 py-2 align-top ${num ? "num" : ""} ${tones?.[i] || "text-text-primary"} ${i === highlight ? "font-semibold" : ""}`}
        >
          {v}
          {i === highlight && <span className="text-accent-blue ml-1.5" title="Highest">▲</span>}
        </td>
      ))}
    </tr>
  );
}

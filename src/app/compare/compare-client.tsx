"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import type { CuratorDashboardItem } from "@/lib/types/api";

const MAX_COMPARE = 4;

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
        if (!cancelled) setError("Could not load curator data.");
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
    return <div className="font-mono text-sm text-text-tertiary py-16 text-center">{error}</div>;
  }

  return (
    <div className="max-w-[1100px]">
      <header className="mb-8">
        <h1 className="font-display font-bold text-3xl tracking-tight">Compare curators</h1>
        <p className="text-sm text-text-secondary mt-1">
          Side-by-side on the dimensions allocators care about — pick up to {MAX_COMPARE}.
        </p>
      </header>

      {/* ── Selection ── */}
      <div className="flex gap-3 items-start flex-wrap mb-8">
        <div className="relative flex-1 min-w-[260px] max-w-[420px]">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-text-tertiary pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              selectedAddresses.length >= MAX_COMPARE
                ? "Remove a curator to add another"
                : "Add a curator by name…"
            }
            disabled={selectedAddresses.length >= MAX_COMPARE}
            aria-label="Search curators to compare"
            className="w-full bg-background-subtle border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue disabled:opacity-50"
          />
          {candidates.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-background-elevated border border-border rounded-lg overflow-hidden shadow-xl">
              {candidates.map((c) => (
                <li key={c.curatorAddress}>
                  <button
                    type="button"
                    onClick={() => addCurator(c.curatorAddress)}
                    className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm text-text-primary hover:bg-background-hover transition-colors"
                  >
                    <span className="truncate">{c.name || c.curatorAddress.slice(0, 10)}</span>
                    <span className="font-mono text-xs text-text-tertiary tabular-nums">
                      {compactUsd(c.totalAUM)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.map((c) => (
            <span
              key={c.curatorAddress}
              className="inline-flex items-center gap-2 font-mono text-xs border border-border rounded-lg px-3 py-2 bg-background-subtle text-text-primary"
            >
              {c.name || c.curatorAddress.slice(0, 8)}
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
      </div>

      {selected.length === 0 && (
        <div className="border border-border rounded-2xl bg-background-subtle p-10 text-center">
          <Plus className="w-6 h-6 text-text-tertiary mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-text-secondary">
            Add curators above, or start from a profile&rsquo;s{" "}
            <span className="font-mono text-xs border border-border rounded px-1.5 py-0.5">Compare</span>{" "}
            action. Top curators by TVL:
          </p>
          <div className="flex gap-2 justify-center flex-wrap mt-4">
            {curators.slice(0, 5).map((c) => (
              <button
                key={c.curatorAddress}
                type="button"
                onClick={() => addCurator(c.curatorAddress)}
                className="font-mono text-xs border border-border rounded-lg px-3 py-1.5 text-text-secondary hover:text-text-primary hover:bg-background-hover transition-colors"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="overflow-x-auto border border-border rounded-2xl bg-background-subtle">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary font-medium p-4 w-[160px]">
                  Dimension
                </th>
                {selected.map((c) => (
                  <th key={c.curatorAddress} className="text-left p-4">
                    <Link
                      href={`/curator/${c.curatorAddress}`}
                      className="font-display font-bold text-base text-text-primary hover:text-accent-blue transition-colors"
                    >
                      {c.name || c.curatorAddress.slice(0, 10)}
                    </Link>
                    <div className="font-mono text-[0.62rem] text-text-tertiary mt-0.5">
                      {c.jurisdiction || "Jurisdiction unknown"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono text-sm">
              <Row label="AUM" cells={selected.map((c) => compactUsd(c.totalAUM))} highlight={best(selected.map((c) => c.totalAUM))} />
              <Row
                label="30d TVL change"
                cells={selected.map((c) =>
                  c.tvlChangePct30d ? `${c.tvlChangePct30d > 0 ? "+" : ""}${c.tvlChangePct30d.toFixed(1)}%` : "—"
                )}
                tones={selected.map((c) =>
                  c.tvlChangePct30d > 0 ? "text-accent-green" : c.tvlChangePct30d < 0 ? "text-accent-red" : ""
                )}
              />
              <Row label="Vaults" cells={selected.map((c) => String(c.vaultCount))} />
              <Row
                label="Avg net APY"
                cells={selected.map((c) => `${(c.avgNetApy * 100).toFixed(2)}%`)}
                highlight={best(selected.map((c) => c.avgNetApy))}
              />
              <Row
                label="Est. annual yield"
                cells={selected.map((c) => formatCurrency(c.totalAUM * c.avgNetApy))}
              />
              <tr className="border-t border-border-subtle">
                <td className="p-4 text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary align-top">Grade mix</td>
                {selected.map((c) => {
                  const g = c.gradeDistribution;
                  const total = g.high + g.medium + g.low || 1;
                  return (
                    <td key={c.curatorAddress} className="p-4 align-top">
                      <div className="h-2 rounded overflow-hidden flex bg-background-elevated max-w-[160px]" role="img" aria-label={`${g.high} high, ${g.medium} medium, ${g.low} low grade vaults`}>
                        {g.high > 0 && <span className="bg-accent-green" style={{ width: `${(g.high / total) * 100}%` }} />}
                        {g.medium > 0 && <span className="bg-accent-yellow" style={{ width: `${(g.medium / total) * 100}%` }} />}
                        {g.low > 0 && <span className="bg-accent-red" style={{ width: `${(g.low / total) * 100}%` }} />}
                      </div>
                      <div className="text-[0.62rem] text-text-tertiary mt-1.5 tabular-nums">
                        <span className="text-accent-green">{g.high}H</span> · <span className="text-accent-yellow">{g.medium}M</span> ·{" "}
                        <span className={g.low ? "text-accent-red" : ""}>{g.low}L</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
              <Row
                label="Risk posture"
                cells={selected.map((c) => `${c.riskScore} · ${c.strategyType}`)}
                tones={selected.map((c) =>
                  c.riskScore === "low" ? "text-accent-green" : c.riskScore === "high" ? "text-accent-red" : "text-accent-yellow"
                )}
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
      )}

      <p className="font-mono text-xs text-text-tertiary mt-4">
        All figures from the latest 6h snapshot. Open a curator&rsquo;s profile for
        track record, per-vault grades, and the full change history.
      </p>
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
}: {
  label: string;
  cells: string[];
  tones?: string[];
  highlight?: number;
}) {
  return (
    <tr className="border-t border-border-subtle">
      <td className="p-4 text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary align-top">{label}</td>
      {cells.map((v, i) => (
        <td
          key={i}
          className={`p-4 align-top tabular-nums ${tones?.[i] || "text-text-primary"} ${i === highlight ? "font-semibold" : ""}`}
        >
          {v}
          {i === highlight && <span className="text-accent-blue ml-1.5" title="Highest">▲</span>}
        </td>
      ))}
    </tr>
  );
}

"use client";

import { useEffect, useState } from "react";

export interface DataAsOfSource {
  key: string;
  label: string;
  kind: "vaults" | "table";
  lastAt: string | null;
  slaHours: number;
  stale: boolean;
}

const TTL_MS = 10 * 60_000;
let cached: { at: number; promise: Promise<DataAsOfSource[]> } | null = null;

/** One request per ~10 min per tab, shared by every stamp on the page. */
function loadSources(): Promise<DataAsOfSource[]> {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    const promise = fetch("/api/data-as-of")
      .then((r) => (r.ok ? r.json() : { sources: [] }))
      .then((j) => (Array.isArray(j?.sources) ? (j.sources as DataAsOfSource[]) : []))
      .catch(() => {
        cached = null; // retry on the next mount
        return [];
      });
    cached = { at: Date.now(), promise };
  }
  return cached.promise;
}

function fmt(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Date.now() - d.getTime() < 24 * 3600_000) {
    return `${d.toISOString().slice(11, 16)} UTC`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Per-source "as of" stamp. `sources` filters by source key; a bare prefix
 * matches its sub-sources ("morpho" → Morpho V1 + V2). Default: every vault
 * source. A source past its SLA gets an amber "stale" chip.
 */
export function DataAsOf({ sources, className = "" }: { sources?: string[]; className?: string }) {
  const [rows, setRows] = useState<DataAsOfSource[] | null>(null);

  useEffect(() => {
    let active = true;
    loadSources().then((s) => active && setRows(s));
    return () => {
      active = false;
    };
  }, []);

  if (!rows) return null;
  const shown = rows.filter((r) =>
    sources
      ? sources.some((s) => r.key === s || r.key.startsWith(`${s}-`))
      : r.kind === "vaults" && r.lastAt !== null
  );
  if (shown.length === 0) return null;

  return (
    <div className={`font-mono text-xs text-text-tertiary flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <span className="uppercase tracking-[0.08em] text-[0.62rem]">Data as of</span>
      {shown.map((r) => (
        <span
          key={r.key}
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
          title={`${r.label}: newest data ${r.lastAt ?? "never"} · SLA ${r.slaHours}h`}
        >
          <span className="text-text-secondary">{r.label}</span>
          <span className="tabular-nums">{fmt(r.lastAt)}</span>
          {r.stale && (
            <span className="px-1.5 py-px rounded text-[0.62rem] uppercase tracking-[0.06em] bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30">
              stale
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

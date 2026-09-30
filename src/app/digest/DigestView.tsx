/**
 * Presentational render of a stored digest's structured payload. Server component
 * (no interactivity) shared by /digest and /digest/[slug].
 */

import Link from "next/link";
import type { DigestData } from "@/lib/digest/types";
import { BAND_STYLE } from "@/lib/stress-band-style";

function usd(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
}
function signedPct(n: number, d = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
}

function SectionHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-3 pb-2 border-b border-border flex-wrap mt-8">
      <span className="w-[7px] h-[7px] rounded-sm bg-accent-blue -translate-y-0.5" />
      <span className="font-display font-bold text-lg tracking-tight">{title}</span>
      {meta && <span className="font-mono text-xs text-text-tertiary ml-auto text-right">{meta}</span>}
    </div>
  );
}

export function DigestView({
  title,
  summary,
  date,
  generatedBy,
  data,
}: {
  title: string;
  summary: string | null;
  date: Date;
  generatedBy: string;
  data: DigestData;
}) {
  const e = data.ecosystem;
  const band = data.stress.band;

  return (
    <article>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">
        Curator Daily · {data.slug} ·{" "}
        {generatedBy === "template" ? "deterministic" : `written by ${generatedBy}`}
      </div>
      <h1 className="font-display font-bold text-[clamp(1.6rem,3.4vw,2.2rem)] leading-tight tracking-tight mt-2 mb-3">
        {title}
      </h1>
      {summary && <p className="text-text-secondary text-[15px] leading-relaxed max-w-[720px]">{summary}</p>}

      {/* Stress index + ecosystem stats */}
      <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-center mt-6 p-5 rounded-2xl border border-border bg-background-subtle">
        <div className={`rounded-xl border px-5 py-4 text-center ${BAND_STYLE[band]}`}>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] opacity-80">Curator stress</div>
          <div className="font-mono font-bold text-3xl tabular-nums mt-1">{data.stress.score}</div>
          <div className="font-mono text-sm font-semibold">{band}</div>
        </div>
        <div className="font-mono text-xs text-text-secondary leading-relaxed">
          <div className="flex gap-x-6 gap-y-1 flex-wrap mb-2">
            <span><span className="text-text-tertiary">TVL</span> <b className="text-text-primary">{usd(e.totalTvl)}</b></span>
            <span><span className="text-text-tertiary">stable</span> <b className="text-text-primary">{Math.round(e.stablePct)}%</b></span>
            <span><span className="text-text-tertiary">24h flow</span> <b className={e.netFlowUsd >= 0 ? "text-accent-green" : "text-accent-red"}>{usd(e.netFlowUsd)} ({signedPct(e.netFlowPct)})</b></span>
            <span><span className="text-text-tertiary">curators</span> <b className="text-text-primary">{e.curatorCount}</b></span>
          </div>
          <div className="text-text-tertiary">
            concentration {data.stress.components.concentration} · flow {data.stress.components.flow ?? "—"} — {data.stress.drivers.join("; ")}.
          </div>
        </div>
      </div>

      {/* Per-source as-of (digests since 2026-09-30) */}
      {data.asOf && data.asOf.some((s) => s.lastAt) && (
        <div className="font-mono text-[11px] text-text-tertiary mt-3 flex flex-wrap gap-x-3 gap-y-1">
          <span className="uppercase tracking-[0.08em]">Data as of</span>
          {data.asOf
            .filter((s) => s.lastAt)
            .map((s) => (
              <span key={s.key} className="whitespace-nowrap">
                <span className="text-text-secondary">{s.label}</span> {s.lastAt!.slice(5, 16).replace("T", " ")} UTC
                {s.stale && <span className="text-accent-yellow"> · stale</span>}
              </span>
            ))}
        </div>
      )}
      {(data.excludedSources?.length ?? 0) > 0 && (
        <p className="font-mono text-[11px] text-accent-yellow mt-1">
          Not shown in the tables (data past SLA): {data.excludedSources!.join(", ")}.
        </p>
      )}

      {/* Flows */}
      {(data.topInflows.length > 0 || data.topOutflows.length > 0) && (
        <section>
          <SectionHead title="Flows" meta="24h · curator AUM" />
          <div className="grid sm:grid-cols-2 gap-4">
            <FlowList label="Inflows" rows={data.topInflows} positive />
            <FlowList label="Outflows" rows={data.topOutflows} />
          </div>
        </section>
      )}

      {/* Concentration */}
      {data.concentration.length > 0 && (
        <section>
          <SectionHead title="Single-manager concentration" meta="stablecoins ≥84% one curator" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {data.concentration.slice(0, 6).map((c) => (
              <div key={c.symbol} className="rounded-xl border border-border bg-background-subtle px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-text-primary truncate">{c.symbol}</span>
                  <span className="font-mono text-xs text-accent-yellow tabular-nums">{Math.round(c.topCuratorPct)}%</span>
                </div>
                <div className="font-mono text-[11px] text-text-tertiary mt-1 truncate">{usd(c.totalUsd)} · {c.curatorCount} curator{c.curatorCount === 1 ? "" : "s"}</div>
                <div className="font-mono text-[11px] text-text-secondary mt-0.5 truncate">{c.topCurator ?? "—"}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Yield movers */}
      {data.yieldMovers.length > 0 && (
        <section>
          <SectionHead title="Yield movers" meta="24h · net APY" />
          <div className="font-mono text-sm divide-y divide-border-subtle border border-border rounded-xl overflow-hidden">
            {data.yieldMovers.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-background-subtle">
                <span className="truncate text-text-secondary">{m.vaultName} <span className="text-text-tertiary">· {m.assetSymbol}{m.curator ? ` · ${m.curator}` : ""}</span></span>
                <span className="tabular-nums whitespace-nowrap">
                  {m.oldApyPct.toFixed(2)}% → {m.newApyPct.toFixed(2)}%{" "}
                  <span className={m.deltaPct >= 0 ? "text-accent-green" : "text-accent-red"}>({signedPct(m.deltaPct, 2)})</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* New vaults */}
      {data.newVaults.length > 0 && (
        <section>
          <SectionHead title="New vaults" meta="first seen in 24h" />
          <div className="font-mono text-sm divide-y divide-border-subtle border border-border rounded-xl overflow-hidden">
            {data.newVaults.map((v, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-background-subtle">
                <span className="truncate text-text-secondary">{v.name} <span className="text-text-tertiary">· {v.assetSymbol} · {v.chainName}{v.curator ? ` · ${v.curator}` : ""}</span></span>
                <span className="tabular-nums text-text-primary">{usd(v.tvl)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Newswire — fresh curator-tagged coverage (digests since 2026-08-13) */}
      {(data.news?.length ?? 0) > 0 && (
        <section>
          <SectionHead title="Newswire" meta="48h · curator-tagged press" />
          <div className="divide-y divide-border-subtle border border-border rounded-xl overflow-hidden">
            {data.news!.map((n, i) => (
              <a
                key={i}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3.5 py-2.5 bg-background-subtle hover:bg-background-elevated transition-colors"
              >
                <span className="text-sm text-text-primary">{n.title}</span>
                <span className="font-mono text-[11px] text-text-tertiary ml-2">
                  {[n.curator, n.source].filter(Boolean).join(" · ")}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Curator spotlight — daily rotation through the vetted dossier set */}
      {data.spotlight && (
        <section>
          <SectionHead title="Curator spotlight" meta={data.spotlight.name} />
          <div className="rounded-xl border border-border bg-background-subtle px-4 py-3.5">
            <p className="text-sm leading-relaxed text-text-secondary">
              {data.spotlight.sentences.join(" ")}
            </p>
            {data.spotlight.quote && (
              <p className="text-sm italic text-text-primary mt-2.5">
                “{data.spotlight.quote.text}”{" "}
                <a
                  href={data.spotlight.quote.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="not-italic font-mono text-[11px] text-text-tertiary hover:text-accent-blue"
                >
                  — {data.spotlight.quote.source}
                </a>
              </p>
            )}
            <a
              href={`/curator/${data.spotlight.slug}`}
              className="inline-block font-mono text-xs text-accent-blue mt-2.5"
            >
              Full profile →
            </a>
          </div>
        </section>
      )}

      {/* Incidents + alerts */}
      <section>
        <SectionHead title="Incidents & alerts" meta="24h" />
        <p className="font-mono text-sm text-text-secondary">
          {data.incidents.stale ? (
            "Liquidation feed past its SLA: incidents omitted."
          ) : data.incidents.count > 0 ? (
            <>
              {data.incidents.count} liquidation{data.incidents.count === 1 ? "" : "s"}, {usd(data.incidents.seizedUsd)} seized
              {data.incidents.badDebtUsd > 0 ? <>, <b className="text-accent-red">{usd(data.incidents.badDebtUsd)} bad debt</b></> : ", no bad debt"}.
            </>
          ) : (
            "No liquidations in the last 24h."
          )}{" "}
          <span className="text-text-tertiary">
            Alert tape: {data.alertCounts.critical} critical · {data.alertCounts.warning} warning · {data.alertCounts.info} info.
          </span>
        </p>
      </section>

      <p className="font-mono text-[11px] text-text-tertiary mt-8 pt-4 border-t border-border-subtle leading-relaxed">
        Generated from the CuratorWatch production database on {date.toISOString().slice(0, 16).replace("T", " ")} UTC.
        Latest-snapshot reads; net APY sanitized at the 200% guard. Not investment advice.
      </p>
    </article>
  );
}

function FlowList({
  label,
  rows,
  positive = false,
}: {
  label: string;
  rows: DigestData["topInflows"];
  positive?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <div className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary mb-2">{label}</div>
        <div className="font-mono text-sm text-text-tertiary">—</div>
      </div>
    );
  }
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary mb-2">{label}</div>
      <div className="font-mono text-sm divide-y divide-border-subtle border border-border rounded-xl overflow-hidden">
        {rows.map((f) => (
          <Link
            key={f.curatorId}
            href={`/curator/${f.slug}`}
            className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-background-subtle hover:bg-background-hover transition-colors"
          >
            <span className="truncate text-text-secondary">{f.name ?? "—"}</span>
            <span className={`tabular-nums whitespace-nowrap ${positive ? "text-accent-green" : "text-accent-red"}`}>
              {usd(f.deltaUsd)} ({signedPct(f.pct)})
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

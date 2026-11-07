/**
 * Presentational render of a stored digest's structured payload. Server component
 * (no interactivity) shared by /digest and /digest/[slug].
 */

import Link from "next/link";
import type { DigestData } from "@/lib/digest/types";
import { BAND_STYLE } from "@/lib/stress-band-style";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";
import { Quote } from "@/components/layout/Quote";

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

export function DigestView({
  title,
  summary,
  date,
  generatedBy,
  data,
  actions,
}: {
  title: string;
  summary: string | null;
  date: Date;
  generatedBy: string;
  data: DigestData;
  /** Page-bar actions (e.g. the RSS link on /digest). */
  actions?: React.ReactNode;
}) {
  const e = data.ecosystem;
  const band = data.stress.band;

  return (
    <article className="space-y-1.5">
      <PageHeader
        title={title}
        description={summary ?? undefined}
        breadcrumbs={[{ label: "Curator Daily", href: "/digest" }, { label: data.slug }]}
        actions={actions}
      />

      {/* ── Quote line: stress index + ecosystem in one row ── */}
      <section aria-label="Curator stress and ecosystem" className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Curator stress · ecosystem</h2>
          <span className="panel-meta">
            {data.slug} · {generatedBy === "template" ? "deterministic" : `written by ${generatedBy}`}
          </span>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          <div className="px-3 py-2.5 border-border border-b lg:border-b-0 border-r min-w-0">
            <dt className="label">Stress index</dt>
            <dd className="flex items-baseline gap-2 mt-1.5">
              <span className="num font-semibold text-[1.45rem] leading-none text-accent-blue">{data.stress.score}</span>
              <span className={`label px-1.5 py-0.5 ${BAND_STYLE[band]}`}>{band}</span>
            </dd>
          </div>
          <Quote k="Tracked TVL" v={usd(e.totalTvl)} />
          <Quote k="Stablecoin share" v={`${Math.round(e.stablePct)}%`} />
          <Quote
            k="24h net flow"
            v={usd(e.netFlowUsd)}
            sub={signedPct(e.netFlowPct)}
            tone={e.netFlowUsd >= 0 ? "up" : "down"}
            subClass={`num text-xs ${e.netFlowUsd >= 0 ? "up" : "down"}`}
          />
          <Quote k="Curators" v={String(e.curatorCount)} />
        </dl>
        <div className="border-t border-border px-3 py-2 text-xs text-text-secondary leading-relaxed">
          <p className="max-w-[70ch]">
            <span className="label mr-2">Drivers</span>
            concentration <span className="num text-text-primary">{data.stress.components.concentration}</span> ·
            flow <span className="num text-text-primary">{data.stress.components.flow ?? "—"}</span> ·{" "}
            {data.stress.drivers.join("; ")}.
          </p>
          {/* Per-source as-of (digests since 2026-09-30) */}
          {data.asOf && data.asOf.some((s) => s.lastAt) && (
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="label">Data as of</span>
              {data.asOf
                .filter((s) => s.lastAt)
                .map((s) => (
                  <span key={s.key} className="whitespace-nowrap text-text-tertiary">
                    <span className="text-text-secondary">{s.label}</span>{" "}
                    <span className="num">{s.lastAt!.slice(5, 16).replace("T", " ")} UTC</span>
                    {s.stale && <span className="text-accent-yellow"> · stale</span>}
                  </span>
                ))}
            </div>
          )}
          {(data.excludedSources?.length ?? 0) > 0 && (
            <p className="mt-1.5 text-accent-yellow">
              Not shown in the tables (data past SLA): {data.excludedSources!.join(", ")}.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-1.5 lg:grid-cols-2 items-start">
        {/* Flows */}
        {(data.topInflows.length > 0 || data.topOutflows.length > 0) && (
          <>
            <FlowList label="Inflows" rows={data.topInflows} positive />
            <FlowList label="Outflows" rows={data.topOutflows} />
          </>
        )}

        {/* Concentration */}
        {data.concentration.length > 0 && (
          <Panel title="Single-manager concentration" meta="stablecoins ≥84% one curator">
            <table className="w-full text-sm table-fixed">
              <caption className="sr-only">Stablecoins where one curator manages at least 84% of tracked supply</caption>
              <thead>
                <tr className="h-7 border-b border-border bg-background">
                  <th scope="col" className="label text-left pl-3 w-[22%]">Asset</th>
                  <th scope="col" className="label text-left">Top curator</th>
                  <th scope="col" className="label text-right w-[5.5rem] hidden sm:table-cell">Supply</th>
                  <th scope="col" className="label text-right pr-3 w-[4.5rem]">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.concentration.slice(0, 6).map((c) => (
                  <tr key={c.symbol} className="h-8 border-b border-border-subtle last:border-0">
                    <td className="pl-3 font-semibold text-text-primary truncate">{c.symbol}</td>
                    <td className="text-text-secondary truncate">
                      {c.topCurator ?? "—"}
                      <span className="text-text-tertiary text-xs">
                        {" "}· <span className="num">{c.curatorCount}</span> curator{c.curatorCount === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="num text-right text-text-secondary hidden sm:table-cell">{usd(c.totalUsd)}</td>
                    <td className="num text-right pr-3 text-accent-yellow">{Math.round(c.topCuratorPct)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {/* Yield movers */}
        {data.yieldMovers.length > 0 && (
          <Panel title="Yield movers" meta="24h · net APY">
            <table className="w-full text-sm table-fixed">
              <caption className="sr-only">Vaults with the largest 24h net APY change</caption>
              <thead>
                <tr className="h-7 border-b border-border bg-background">
                  <th scope="col" className="label text-left pl-3">Vault</th>
                  <th scope="col" className="label text-right w-[9.5rem]">Net APY</th>
                  <th scope="col" className="label text-right pr-3 w-[5.5rem]">Change</th>
                </tr>
              </thead>
              <tbody>
                {data.yieldMovers.map((m, i) => (
                  <tr key={i} className="h-8 border-b border-border-subtle last:border-0">
                    <td className="pl-3 truncate text-text-primary" title={m.vaultName}>
                      {m.vaultName}{" "}
                      <span className="text-text-tertiary text-xs">
                        · {m.assetSymbol}
                        {m.curator ? ` · ${m.curator}` : ""}
                      </span>
                    </td>
                    <td className="num text-right text-text-secondary whitespace-nowrap">
                      {m.oldApyPct.toFixed(2)}% → <span className="text-text-primary">{m.newApyPct.toFixed(2)}%</span>
                    </td>
                    <td className={`num text-right pr-3 ${m.deltaPct >= 0 ? "up" : "down"}`}>
                      {signedPct(m.deltaPct, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {/* New vaults */}
        {data.newVaults.length > 0 && (
          <Panel title="New vaults" meta="first seen in 24h">
            <table className="w-full text-sm table-fixed">
              <caption className="sr-only">Vaults first seen in the last 24 hours</caption>
              <thead>
                <tr className="h-7 border-b border-border bg-background">
                  <th scope="col" className="label text-left pl-3">Vault</th>
                  <th scope="col" className="label text-left w-[6.5rem] hidden sm:table-cell">Chain</th>
                  <th scope="col" className="label text-right pr-3 w-[5.5rem]">TVL</th>
                </tr>
              </thead>
              <tbody>
                {data.newVaults.map((v, i) => (
                  <tr key={i} className="h-8 border-b border-border-subtle last:border-0">
                    <td className="pl-3 truncate text-text-primary" title={v.name}>
                      {v.name}{" "}
                      <span className="text-text-tertiary text-xs">
                        · {v.assetSymbol}
                        <span className="sm:hidden"> · {v.chainName}</span>
                        {v.curator ? ` · ${v.curator}` : ""}
                      </span>
                    </td>
                    <td className="text-text-secondary truncate hidden sm:table-cell">{v.chainName}</td>
                    <td className="num text-right pr-3 text-text-primary">{usd(v.tvl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        {/* Newswire — fresh curator-tagged coverage (digests since 2026-08-13) */}
        {(data.news?.length ?? 0) > 0 && (
          <Panel title="Newswire" meta="48h · curator-tagged press">
            <ul>
              {data.news!.map((n, i) => (
                <li key={i} className="border-b border-border-subtle last:border-0">
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-3 py-1.5 hover:bg-background-hover transition-colors group"
                  >
                    <span className="text-sm text-text-primary group-hover:text-accent-blue">{n.title}</span>
                    <span className="text-xs text-text-tertiary ml-2">
                      {[n.curator, n.source].filter(Boolean).join(" · ")}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {/* Curator spotlight — daily rotation through the vetted dossier set */}
        {data.spotlight && (
          <Panel title="Curator spotlight" meta={data.spotlight.name} bodyClassName="p-3">
            <p className="text-sm leading-relaxed text-text-secondary max-w-[70ch]">
              {data.spotlight.sentences.join(" ")}
            </p>
            {data.spotlight.quote && (
              <p className="text-sm italic text-text-primary mt-2 max-w-[70ch]">
                “{data.spotlight.quote.text}”{" "}
                <a
                  href={data.spotlight.quote.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="not-italic text-xs text-text-tertiary hover:text-accent-blue"
                >
                  — {data.spotlight.quote.source}
                </a>
              </p>
            )}
            <a
              href={`/curator/${data.spotlight.slug}`}
              className="inline-block text-xs text-accent-blue hover:underline mt-2"
            >
              Full profile →
            </a>
          </Panel>
        )}

        {/* Incidents + alerts */}
        <Panel title="Incidents & alerts" meta="24h" bodyClassName="p-3">
          <p className="text-sm text-text-secondary leading-relaxed max-w-[70ch]">
            {data.incidents.stale ? (
              "Liquidation feed past its SLA: incidents omitted."
            ) : data.incidents.count > 0 ? (
              <>
                <span className="num text-text-primary">{data.incidents.count}</span> liquidation
                {data.incidents.count === 1 ? "" : "s"},{" "}
                <span className="num text-text-primary">{usd(data.incidents.seizedUsd)}</span> seized
                {data.incidents.badDebtUsd > 0 ? (
                  <>
                    , <b className="num text-accent-red">{usd(data.incidents.badDebtUsd)} bad debt</b>
                  </>
                ) : (
                  ", no bad debt"
                )}
                .
              </>
            ) : (
              "No liquidations in the last 24h."
            )}
          </p>
          <p className="text-xs text-text-tertiary mt-1.5">
            Alert tape: <span className="num">{data.alertCounts.critical}</span> critical ·{" "}
            <span className="num">{data.alertCounts.warning}</span> warning ·{" "}
            <span className="num">{data.alertCounts.info}</span> info.
          </p>
        </Panel>
      </div>

      <p className="text-xs text-text-tertiary pt-1 leading-relaxed max-w-[90ch]">
        Generated from the CuratorWatch production database on{" "}
        <span className="num">{date.toISOString().slice(0, 16).replace("T", " ")} UTC</span>. Latest-snapshot
        reads; net APY sanitized at the 200% guard. Not investment advice.
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
  return (
    <Panel title={label} meta="24h · curator AUM">
      {rows.length === 0 ? (
        <p className="px-3 py-2 text-sm text-text-tertiary">No curator {positive ? "inflows" : "outflows"} in this window.</p>
      ) : (
        <ul>
          {rows.map((f) => (
            <li key={f.curatorId}>
              <Link
                href={`/curator/${f.slug}`}
                className="flex items-center justify-between gap-3 px-3 h-8 border-b border-border-subtle hover:bg-background-hover transition-colors group"
              >
                <span className="truncate text-sm text-text-primary group-hover:text-accent-blue">{f.name ?? "—"}</span>
                <span className={`num text-sm whitespace-nowrap ${positive ? "up" : "down"}`}>
                  {usd(f.deltaUsd)} <span className="text-xs">({signedPct(f.pct)})</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

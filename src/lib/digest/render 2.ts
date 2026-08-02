/**
 * Deterministic v1 renderer for the Curator Daily digest. Turns DigestData into a
 * number-dense markdown body + title + summary in the house voice. This is the
 * fallback that always works; when an LLM key is provisioned, generate.ts can author
 * the prose from the same DigestData instead (the scores still make the claims).
 */

import type { DigestData } from "./types";

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

export function renderTitle(d: DigestData): string {
  const out = d.topOutflows[0];
  const inf = d.topInflows[0];
  let lead: string;
  if (out && Math.abs(out.deltaUsd) >= (inf?.deltaUsd ?? 0)) {
    lead = `${out.name ?? "A curator"} sheds ${usd(Math.abs(out.deltaUsd))}`;
  } else if (inf) {
    lead = `${inf.name ?? "A curator"} adds ${usd(inf.deltaUsd)}`;
  } else {
    lead = `stablecoins ${Math.round(d.ecosystem.stablePct)}% of curated TVL`;
  }
  return `Curator Daily — ${d.slug}: ${lead}; stress ${d.stress.band}`;
}

export function renderSummary(d: DigestData): string {
  const e = d.ecosystem;
  return (
    `Stress ${d.stress.band} (${d.stress.score}/100). ` +
    `${e.curatorCount} curators run ${usd(e.totalTvl)}, ${Math.round(e.stablePct)}% in stablecoins; ` +
    `net 24h flow ${usd(e.netFlowUsd)} (${signedPct(e.netFlowPct)}). ` +
    `${d.concentration.length} single-manager stablecoin flag${d.concentration.length === 1 ? "" : "s"}.`
  );
}

export function renderMarkdown(d: DigestData): string {
  const e = d.ecosystem;
  const L: string[] = [];

  L.push(`_Curator Daily · ${d.slug} · ${e.curatorCount} curators · ${usd(e.totalTvl)} tracked · written by template (deterministic)._`);
  L.push("");

  // Lead
  L.push(`## The state of play`);
  L.push(
    `${e.curatorCount} curators manage **${usd(e.totalTvl)}** across ${e.vaultCount} products, ` +
      `**${Math.round(e.stablePct)}%** of it in stablecoins. Net flow over the last 24h was ` +
      `**${usd(e.netFlowUsd)}** (${signedPct(e.netFlowPct)} of tracked TVL). The Curator Stress Index reads ` +
      `**${d.stress.band} (${d.stress.score}/100)** — concentration ${d.stress.components.concentration}, ` +
      `flow ${d.stress.components.flow ?? "—"}. ${d.stress.drivers.join("; ")}.`
  );
  L.push("");

  // Flows
  if (d.topInflows.length || d.topOutflows.length) {
    L.push(`## Flows (24h)`);
    if (d.topInflows.length) {
      L.push(`**Inflows.** ` + d.topInflows.map((f) => `${f.name ?? "—"} ${usd(f.deltaUsd)} (${signedPct(f.pct)})`).join(" · ") + ".");
    }
    if (d.topOutflows.length) {
      L.push(`**Outflows.** ` + d.topOutflows.map((f) => `${f.name ?? "—"} ${usd(f.deltaUsd)} (${signedPct(f.pct)})`).join(" · ") + ".");
    }
    L.push("");
  }

  // Concentration
  if (d.concentration.length) {
    L.push(`## Single-manager concentration`);
    L.push(
      `Stablecoins where one curator runs ≥84% of the asset's vault TVL — six dollars, six single points of failure:`
    );
    for (const c of d.concentration.slice(0, 8)) {
      L.push(`- **${c.symbol}** ${usd(c.totalUsd)} — ${Math.round(c.topCuratorPct)}% run by ${c.topCurator ?? "—"} (${c.curatorCount} curator${c.curatorCount === 1 ? "" : "s"})`);
    }
    L.push("");
  }

  // Yield movers
  if (d.yieldMovers.length) {
    L.push(`## Yield movers (24h)`);
    for (const m of d.yieldMovers) {
      L.push(`- **${m.vaultName}** (${m.assetSymbol}${m.curator ? `, ${m.curator}` : ""}): ${m.oldApyPct.toFixed(2)}% → ${m.newApyPct.toFixed(2)}% (${signedPct(m.deltaPct, 2)})`);
    }
    L.push("");
  }

  // New vaults
  if (d.newVaults.length) {
    L.push(`## New vaults`);
    for (const v of d.newVaults) {
      L.push(`- **${v.name}** — ${v.assetSymbol} on ${v.chainName}${v.curator ? `, ${v.curator}` : ""} (${usd(v.tvl)})`);
    }
    L.push("");
  }

  // Incidents
  L.push(`## Incidents (24h)`);
  if (d.incidents.count > 0) {
    L.push(
      `${d.incidents.count} liquidation${d.incidents.count === 1 ? "" : "s"}, ${usd(d.incidents.seizedUsd)} seized` +
        (d.incidents.badDebtUsd > 0 ? `, **${usd(d.incidents.badDebtUsd)} bad debt**` : ", no bad debt") +
        (d.incidents.topCurators.length ? `. Most exposed: ${d.incidents.topCurators.map((c) => `${c.curator} (${usd(c.seizedUsd)})`).join(", ")}.` : ".")
    );
  } else {
    L.push(`No liquidations in the last 24h.`);
  }
  L.push("");

  // Alerts
  const a = d.alertCounts;
  if (a.critical + a.warning + a.info > 0) {
    L.push(`## Alert tape`);
    L.push(`${a.critical} critical · ${a.warning} warning · ${a.info} info detected in the last 24h.`);
    L.push("");
  }

  L.push(`---`);
  L.push(`_Generated from the CuratorWatch production database. Every figure is a latest-snapshot read; net APY sanitized at the 200% guard. Not investment advice._`);

  return L.join("\n");
}

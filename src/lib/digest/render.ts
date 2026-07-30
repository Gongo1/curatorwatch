/**
 * Deterministic wire-format renderer for the Curator Daily — the desk-editor
 * spec (editor-prompt.ts) implemented in code, so the edition needs no LLM key
 * and costs nothing to produce. Fixed sections in a fixed order, fixed-width
 * code-block tables (≤62 chars/line), spec number formats, en-dash minus.
 * The optional Claude path (generate.ts) writes the same format with freer
 * headline/standfirst prose when enabled; this is the always-on baseline.
 */

import type { DigestData, DigestFlowItem } from "./types";

const MINUS = "−"; // − en-dash-style minus per spec (never a hyphen)

/** Money per spec: no decimal below $1M, one below $1B, two above. Unsigned. */
function usd(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(a / 1e3).toFixed(0)}K`;
  return `$${a.toFixed(0)}`;
}

/** Signed money — always carries + or −. */
function susd(n: number): string {
  return `${n < 0 ? MINUS : "+"}${usd(n)}`;
}

/** Signed percentage, one decimal by default. */
function spct(n: number, d = 1): string {
  return `${n < 0 ? MINUS : "+"}${Math.abs(n).toFixed(d)}%`;
}

/** Drop redundant name suffixes, then clip with an ellipsis. */
function clipName(name: string | null, max: number): string {
  let s = (name ?? "—").replace(/\s+(Protocol|Financial|Finance|Capital|Labs|Vault)$/i, "");
  if (s.length > max) s = `${s.slice(0, max - 1)}…`;
  return s;
}

type Align = "l" | "r";

/** Fixed-width table: header, hyphen rule per column, two-space gutters. */
function table(headers: string[], rows: string[][], aligns: Align[]): string[] {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length))
  );
  const pad = (s: string, i: number) =>
    aligns[i] === "r" ? s.padStart(widths[i]) : s.padEnd(widths[i]);
  const line = (cells: string[]) => cells.map(pad).join("  ").trimEnd();
  return [
    "```",
    line(headers),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map(line),
    "```",
  ];
}

const EMPTY = "No changes in the last 24h.";
const ROW_CAP = 10;

function mergedFlows(d: DigestData): DigestFlowItem[] {
  return [...d.topInflows, ...d.topOutflows].sort(
    (a, b) => Math.abs(b.deltaUsd) - Math.abs(a.deltaUsd)
  );
}

/** Headline: under 12 words, a development, no numbers. */
export function renderHeadline(d: DigestData): string {
  const out = d.topOutflows[0];
  const inf = d.topInflows[0];
  if (out && inf) {
    return Math.abs(out.deltaUsd) >= inf.deltaUsd
      ? `${clipName(out.name, 20)} led outflows; ${clipName(inf.name, 20)} took the other side`
      : `${clipName(inf.name, 20)} led inflows as ${clipName(out.name, 20)} slipped`;
  }
  if (out) return `${clipName(out.name, 24)} led a day of exits`;
  if (inf) return `${clipName(inf.name, 24)} led a day of inflows`;
  return "Flows went quiet across the tracked set";
}

export function renderTitle(d: DigestData): string {
  return `Curator Daily — ${d.slug}: ${renderHeadline(d)}`;
}

/** Standfirst: exactly two sentences — why it matters, then the counterweight. */
export function renderSummary(d: DigestData): string {
  const flows = mergedFlows(d);
  const lead = flows[0];
  const first = lead
    ? `The day's largest move ran through ${clipName(lead.name, 24)}, and it was ${
        lead.deltaUsd < 0 ? "an exit" : "an inflow"
      }.`
    : "No curator posted a material flow in the window.";
  const second = `Stress held at ${d.stress.band.toLowerCase()} and ${
    d.incidents.badDebtUsd > 0
      ? `${usd(d.incidents.badDebtUsd)} of new bad debt hit the tape`
      : "no new bad debt hit the tape"
  }.`;
  return `${first} ${second}`;
}

export function renderMarkdown(d: DigestData): string {
  const e = d.ecosystem;
  const L: string[] = [];

  // ── THE LEDGER — the aggregate block owns every headline total ──
  L.push("## THE LEDGER");
  L.push("");
  L.push("```");
  L.push(`Tracked TVL      ${usd(e.totalTvl)}`);
  L.push(`Net flow 24h     ${susd(e.netFlowUsd)} · ${spct(e.netFlowPct)} of prior TVL`);
  L.push(`Stress index     ${d.stress.score} / 100 · ${d.stress.band}`);
  L.push(`Stablecoin       ${e.stablePct.toFixed(1)}% of tracked TVL`);
  L.push(`Coverage         ${e.curatorCount} curators · ${e.vaultCount} products`);
  L.push("```");
  L.push("");
  const a = d.alertCounts;
  L.push(`${a.critical} critical · ${a.warning} warning · ${a.info} info alerts in the window.`);
  L.push("");

  // ── FLOWS — inflows and outflows merged, largest |Δ| first ──
  L.push("## FLOWS");
  L.push("");
  const flows = mergedFlows(d);
  if (flows.length === 0) {
    L.push(EMPTY);
  } else {
    L.push(
      `${clipName(flows[0].name, 24)} posted the day's largest move in either direction. ` +
        `Net 24h flow per curator · Δ% against the curator's prior-day AUM.`
    );
    L.push("");
    L.push(
      ...table(
        ["CURATOR", "ΔUSD", "Δ%", "AUM"],
        flows.slice(0, ROW_CAP).map((f) => [
          clipName(f.name, 14),
          susd(f.deltaUsd),
          spct(f.pct),
          usd(f.currentUsd),
        ]),
        ["l", "r", "r", "r"]
      )
    );
    if (flows.length > ROW_CAP) L.push("", `+${flows.length - ROW_CAP} more in the full edition →`);
    const outlier = flows.find((f) => Math.abs(f.pct) >= 100);
    if (outlier) {
      L.push(
        "",
        `${clipName(outlier.name, 20)}'s ${spct(outlier.pct)} is a triple-digit move on a small base — read the ΔUSD, not the percentage.`
      );
    }
  }
  L.push("");

  // ── YIELD MOVERS ──
  L.push("## YIELD MOVERS");
  L.push("");
  const movers = [...d.yieldMovers].sort((x, y) => Math.abs(y.deltaPct) - Math.abs(x.deltaPct));
  if (movers.length === 0) {
    L.push(EMPTY);
  } else {
    const m0 = movers[0];
    L.push(
      `The largest APY move was ${m0.deltaPct < 0 ? MINUS : "+"}${Math.abs(m0.deltaPct).toFixed(2)}pp, on ${clipName(m0.vaultName, 28)}. ` +
        `Vault APY old→new over the window · Δ in percentage points.`
    );
    L.push("");
    L.push(
      ...table(
        ["VAULT", "CURATOR", "APY %", "ΔPP"],
        movers.slice(0, ROW_CAP).map((m) => [
          clipName(m.vaultName, 23),
          clipName(m.curator, 10),
          `${m.oldApyPct.toFixed(2).padStart(5)}→${m.newApyPct.toFixed(2).padStart(5)}`,
          `${m.deltaPct < 0 ? MINUS : "+"}${Math.abs(m.deltaPct).toFixed(2)}`,
        ]),
        ["l", "l", "r", "r"]
      )
    );
    if (movers.length > ROW_CAP) L.push("", `+${movers.length - ROW_CAP} more in the full edition →`);
  }
  L.push("");

  // ── NEW VAULTS ──
  L.push("## NEW VAULTS");
  L.push("");
  const fresh = [...d.newVaults].sort((x, y) => y.tvl - x.tvl);
  if (fresh.length === 0) {
    L.push(EMPTY);
  } else {
    const chains = new Set(fresh.map((v) => v.chainName));
    L.push(
      `${fresh.length} vault${fresh.length === 1 ? "" : "s"} entered coverage${
        chains.size === 1 ? `, all on ${[...chains][0]}` : ` across ${chains.size} chains`
      }.`
    );
    L.push("");
    L.push(
      ...table(
        ["VAULT", "CURATOR", "ASSET", "CHAIN", "TVL"],
        fresh.slice(0, ROW_CAP).map((v) => [
          clipName(v.name, 22),
          clipName(v.curator, 9),
          v.assetSymbol,
          v.chainName,
          usd(v.tvl),
        ]),
        ["l", "l", "l", "l", "r"]
      )
    );
    if (fresh.length > ROW_CAP) L.push("", `+${fresh.length - ROW_CAP} more in the full edition →`);
  }
  L.push("");

  // ── INCIDENTS ──
  L.push("## INCIDENTS");
  L.push("");
  if (d.incidents.count === 0) {
    L.push(EMPTY);
  } else {
    L.push(
      `${d.incidents.count} liquidation event${d.incidents.count === 1 ? "" : "s"} cleared ${usd(d.incidents.seizedUsd)} of collateral; ` +
        `bad debt recorded was ${usd(d.incidents.badDebtUsd)}.` +
        (d.incidents.topCurators.length ? " Collateral seized per curator, top three." : "")
    );
    if (d.incidents.topCurators.length) {
      L.push("");
      L.push(
        ...table(
          ["CURATOR", "SEIZED"],
          d.incidents.topCurators.map((c) => [clipName(c.curator, 14), usd(c.seizedUsd)]),
          ["l", "r"]
        )
      );
    }
    L.push("", "Event-level detail → curatorwatch.com/liquidations");
  }
  L.push("");

  // ── CONCENTRATION ──
  L.push("## CONCENTRATION");
  L.push("");
  const conc = [...d.concentration].sort((x, y) => y.topCuratorPct - x.topCuratorPct);
  if (conc.length === 0) {
    L.push(EMPTY);
  } else {
    L.push(
      `${conc.length} tracked stable${conc.length === 1 ? " carries" : "s carry"} a dominant manager. ` +
        `Top curator's share of that asset's tracked TVL.`
    );
    L.push("");
    L.push(
      ...table(
        ["ASSET", "TOP CURATOR", "SHARE % OF ASSET TVL"],
        conc.slice(0, ROW_CAP).map((c) => [
          c.symbol,
          clipName(c.topCurator, 14),
          `${c.topCuratorPct.toFixed(1)}%`,
        ]),
        ["l", "l", "r"]
      )
    );
    const solo = conc.find((c) => c.curatorCount === 1 && c.topCuratorPct >= 100);
    if (solo) {
      L.push(
        "",
        `${solo.symbol}'s 100.0% is a single-manager asset — one tracked curator, not a shift.`
      );
    }
  }
  L.push("");

  L.push("Full edition → curatorwatch.com/digest");
  L.push("Not investment advice.");

  return L.join("\n");
}

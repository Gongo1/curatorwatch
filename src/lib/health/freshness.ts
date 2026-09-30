/**
 * Data freshness: per-source SLAs, coverage, and the cron run log.
 *
 * Every source the site shows has an SLA (max age of its newest row). Vault
 * sources are measured from VaultSnapshot.timestamp grouped by Vault.dataSource
 * (Morpho split into V1 and V2: V2 froze for 5 weeks while V1 kept the
 * Morpho max fresh). Coverage = share of the source's RECENTLY REPORTING active
 * vaults (a snapshot in the last COVERAGE_LOOKBACK_DAYS) whose latest snapshot
 * is inside the SLA, so a source that still writes a few rows while most of its
 * vaults went stale is caught too. Cron status reads CronRun (withCronRun).
 */

import { prisma } from "@/lib/db";

const HOUR = 3600_000;

export interface HealthBreach {
  /** Stable dedupe key, e.g. "freshness:turtle", "quality:apy-range". */
  key: string;
  kind: "freshness" | "coverage" | "cron" | "quality";
  message: string;
}

export interface SourceFreshness {
  key: string;
  label: string;
  kind: "vaults" | "table";
  slaHours: number;
  lastAt: string | null;
  ageHours: number | null;
  stale: boolean;
  /** Vault sources only. */
  activeVaults?: number;
  /** Active vaults with a snapshot in the last COVERAGE_LOOKBACK_DAYS (coverage denominator). */
  reportingVaults?: number;
  freshVaults?: number;
  coverage?: number | null;
  lowCoverage?: boolean;
}

interface SourceDef {
  key: string;
  label: string;
  slaHours: number;
}

/** Vault sources by Vault.dataSource ("morpho" splits into V1/V2). */
export const VAULT_SOURCES: SourceDef[] = [
  { key: "morpho-v1", label: "Morpho V1", slaHours: 14 },
  { key: "morpho-v2", label: "Morpho V2", slaHours: 14 },
  { key: "turtle", label: "Turtle", slaHours: 26 },
  { key: "euler", label: "Euler", slaHours: 26 },
  { key: "upshift", label: "Upshift", slaHours: 26 },
  { key: "fund", label: "Tokenized funds", slaHours: 30 },
  { key: "hyperliquid", label: "Hyperliquid", slaHours: 26 },
];
const DEFAULT_VAULT_SLA_HOURS = 26; // a dataSource added later is still watched

/** Non-vault tables the site and the digest read. */
export const TABLE_SOURCES: SourceDef[] = [
  { key: "market-allocations", label: "Market allocations", slaHours: 14 },
  // Ingested every 12h (collect-market-data 04:15/16:15) and aged by EVENT time,
  // so the newest row is always ~12h old just before the next run: a 12h SLA
  // would flap every cycle. 14h = cadence + margin, like market allocations.
  { key: "liquidations", label: "Liquidations", slaHours: 14 },
  { key: "news", label: "Newswire", slaHours: 48 },
  { key: "digest", label: "Curator Daily", slaHours: 25 },
];

/** Below this share of recently reporting vaults inside the SLA, a source is breaching. */
export const COVERAGE_FLOOR = 0.8;

/**
 * Coverage counts only active vaults that reported in this window. Morpho and
 * Turtle have no stale sweep: a vault the source stopped returning stays active
 * with its last snapshot forever. Against ALL active rows, healthy Turtle sat at
 * 77% (434/564 on 2026-09-17) and Morpho V1/V2 at 83-84%, and only drifts down,
 * so the floor would block the digest permanently. Long-dead rows are a
 * data-hygiene issue (counted totals), not a live-source failure; a live outage
 * stays visible here for this many days, and the source-count quality check
 * catches a sudden drop.
 */
export const COVERAGE_LOOKBACK_DAYS = 14;

/** A CronRun still "running" after this long was killed (every maxDuration is <= 15 min). */
const STUCK_AFTER_MIN = 20;

/** Jobs that are not collectors: their own status is not a breach. */
const CRON_STATUS_IGNORED_JOBS = new Set(["health", "alert-email"]);

/** Source key for a vault row. Morpho V2 is told apart by its risk snapshots (see collect-data countTrackedVaults). */
export function vaultSourceKey(dataSource: string, isV2: boolean): string {
  if (dataSource === "morpho") return isV2 ? "morpho-v2" : "morpho-v1";
  return dataSource;
}

function ageHours(at: Date | null, now: Date): number | null {
  return at ? (now.getTime() - at.getTime()) / HOUR : null;
}

function fmtAge(h: number | null): string {
  if (h === null) return "never";
  return h >= 48 ? `${(h / 24).toFixed(1)}d ago` : `${h.toFixed(1)}h ago`;
}

export async function getSourceFreshness(now: Date = new Date()): Promise<SourceFreshness[]> {
  // Latest snapshot per ACTIVE vault (index-backed lateral, ~1.2k rows).
  const vaultRows = await prisma.$queryRaw<
    { src: string; is_v2: boolean; ts: Date | null }[]
  >`
    SELECT v."dataSource" AS src,
      (v."dataSource" = 'morpho' AND EXISTS (
        SELECT 1 FROM "VaultRiskSnapshot" r WHERE r."vaultId" = v.id)) AS is_v2,
      s.timestamp AS ts
    FROM "Vault" v
    LEFT JOIN LATERAL (
      SELECT timestamp FROM "VaultSnapshot"
      WHERE "vaultId" = v.id ORDER BY timestamp DESC LIMIT 1
    ) s ON true
    WHERE v.active`;

  const [tables] = await prisma.$queryRaw<
    { ma: Date | null; liq: Date | null; news: Date | null; digest: Date | null }[]
  >`
    SELECT
      (SELECT max(m.t) FROM "Vault" v CROSS JOIN LATERAL (
         SELECT "snapshotTime" AS t FROM "MarketAllocation"
         WHERE "vaultId" = v.id ORDER BY "snapshotTime" DESC LIMIT 1) m
       WHERE v."dataSource" = 'morpho') AS ma,
      (SELECT max(timestamp) FROM "Liquidation") AS liq,
      (SELECT max("createdAt") FROM "CuratorNews") AS news,
      (SELECT max(date) FROM "Digest" WHERE published) AS digest`;

  const byKey = new Map<string, { active: number; lastAt: Date | null; ts: (Date | null)[] }>();
  for (const r of vaultRows) {
    const key = vaultSourceKey(r.src, r.is_v2);
    const e = byKey.get(key) ?? { active: 0, lastAt: null, ts: [] };
    e.active++;
    e.ts.push(r.ts);
    if (r.ts && (!e.lastAt || r.ts > e.lastAt)) e.lastAt = r.ts;
    byKey.set(key, e);
  }

  const defs = [...VAULT_SOURCES];
  for (const key of byKey.keys()) {
    if (!defs.some((d) => d.key === key)) {
      defs.push({ key, label: key, slaHours: DEFAULT_VAULT_SLA_HOURS });
    }
  }

  const out: SourceFreshness[] = defs.map((d) => {
    const e = byKey.get(d.key);
    const cutoff = now.getTime() - d.slaHours * HOUR;
    const lookback = now.getTime() - COVERAGE_LOOKBACK_DAYS * 24 * HOUR;
    const fresh = e ? e.ts.filter((t) => t && t.getTime() >= cutoff).length : 0;
    const reporting = e ? e.ts.filter((t) => t && t.getTime() >= lookback).length : 0;
    const age = ageHours(e?.lastAt ?? null, now);
    const coverage = reporting > 0 ? fresh / reporting : null;
    return {
      key: d.key,
      label: d.label,
      kind: "vaults",
      slaHours: d.slaHours,
      lastAt: e?.lastAt?.toISOString() ?? null,
      ageHours: age,
      stale: age === null || age > d.slaHours,
      activeVaults: e?.active ?? 0,
      reportingVaults: reporting,
      freshVaults: fresh,
      coverage,
      lowCoverage: coverage !== null && coverage < COVERAGE_FLOOR,
    };
  });

  const tableAt: Record<string, Date | null> = {
    "market-allocations": tables?.ma ?? null,
    liquidations: tables?.liq ?? null,
    news: tables?.news ?? null,
    digest: tables?.digest ?? null,
  };
  for (const d of TABLE_SOURCES) {
    const at = tableAt[d.key];
    const age = ageHours(at, now);
    out.push({
      key: d.key,
      label: d.label,
      kind: "table",
      slaHours: d.slaHours,
      lastAt: at?.toISOString() ?? null,
      ageHours: age,
      stale: age === null || age > d.slaHours,
    });
  }
  return out;
}

export interface CronJobStatus {
  job: string;
  lane: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

export interface StuckRun {
  job: string;
  lane: string | null;
  startedAt: string;
  runningMinutes: number;
}

export interface CronHealth {
  /** Latest FINISHED run per job + lane (last 7 days). */
  jobs: CronJobStatus[];
  /** Runs still "running" well past any maxDuration (last 24h): killed / timed out. */
  stuck: StuckRun[];
  /** Set when the run log itself cannot be read. */
  error?: string;
}

export async function getCronHealth(now: Date = new Date()): Promise<CronHealth> {
  try {
    const weekAgo = new Date(now.getTime() - 7 * 24 * HOUR);
    const dayAgo = new Date(now.getTime() - 24 * HOUR);
    const stuckBefore = new Date(now.getTime() - STUCK_AFTER_MIN * 60_000);

    const latest = await prisma.$queryRaw<
      { job: string; lane: string | null; status: string; startedAt: Date; finishedAt: Date | null; error: string | null }[]
    >`
      SELECT DISTINCT ON (job, lane) job, lane, status, "startedAt", "finishedAt", error
      FROM "CronRun"
      WHERE status <> 'running' AND job <> 'alert-email' AND "startedAt" > ${weekAgo}
      ORDER BY job, lane, "startedAt" DESC`;

    const stuck = await prisma.cronRun.findMany({
      where: { status: "running", startedAt: { gt: dayAgo, lt: stuckBefore } },
      orderBy: { startedAt: "desc" },
      select: { job: true, lane: true, startedAt: true },
    });

    return {
      jobs: latest.map((r) => ({
        job: r.job,
        lane: r.lane,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        error: r.error,
      })),
      stuck: stuck.map((r) => ({
        job: r.job,
        lane: r.lane,
        startedAt: r.startedAt.toISOString(),
        runningMinutes: Math.round((now.getTime() - r.startedAt.getTime()) / 60_000),
      })),
    };
  } catch (e) {
    return { jobs: [], stuck: [], error: e instanceof Error ? e.message : String(e) };
  }
}

const jobLabel = (job: string, lane: string | null) => (lane ? `${job}:${lane}` : job);

export function freshnessBreaches(sources: SourceFreshness[], cron?: CronHealth): HealthBreach[] {
  const out: HealthBreach[] = [];
  for (const s of sources) {
    if (s.stale) {
      out.push({
        key: `freshness:${s.key}`,
        kind: "freshness",
        message: `${s.label}: newest row ${fmtAge(s.ageHours)} (SLA ${s.slaHours}h)`,
      });
    } else if (s.lowCoverage) {
      out.push({
        key: `coverage:${s.key}`,
        kind: "coverage",
        message: `${s.label}: only ${s.freshVaults}/${s.reportingVaults} vaults that reported in the last ${COVERAGE_LOOKBACK_DAYS}d (${Math.round(
          (s.coverage ?? 0) * 100
        )}%) have a snapshot inside the ${s.slaHours}h SLA (floor ${COVERAGE_FLOOR * 100}%; ${s.activeVaults} active)`,
      });
    }
  }
  if (!cron) return out;
  if (cron.error) {
    out.push({ key: "cron-log", kind: "cron", message: `CronRun log unreadable: ${cron.error}` });
  }
  for (const j of cron.jobs) {
    if (j.status === "ok" || CRON_STATUS_IGNORED_JOBS.has(j.job)) continue;
    out.push({
      key: `cron:${jobLabel(j.job, j.lane)}`,
      kind: "cron",
      message: `${jobLabel(j.job, j.lane)} last run ${j.status} (${j.startedAt}): ${j.error ?? "no error text"}`,
    });
  }
  const seenStuck = new Set<string>();
  for (const r of cron.stuck) {
    const label = jobLabel(r.job, r.lane);
    if (seenStuck.has(label)) continue;
    seenStuck.add(label);
    out.push({
      key: `stuck:${label}`,
      kind: "cron",
      message: `${label} run started ${r.startedAt} never finished (${r.runningMinutes} min; killed or timed out)`,
    });
  }
  return out;
}

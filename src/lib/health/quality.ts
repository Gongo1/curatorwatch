/**
 * Data-quality assertions over what the site counts (ACTIVE vaults, latest
 * snapshot). Each check returns ok + a few sample rows; a failing check is a
 * health breach (email) and blocks the Curator Daily from publishing.
 *
 * The thresholds come from real incidents: phantom accrual vaults reporting
 * an APY of 2979.958 (e^8 - 1, the IRM max) with the share price jumping
 * 83.8 -> 438.5; the Axis raw-units $92B TVL row; weETH/eETH and bridged
 * copies double-counting the same asset across sources; whole sources going
 * quiet without a single error.
 */

import { prisma } from "@/lib/db";
import { vaultSourceKey, type HealthBreach } from "./freshness";

const HOUR = 3600_000;

export const QUALITY_LIMITS = {
  maxNetApy: 2, // decimal: 200%
  minNetApy: -0.5,
  maxVaultTvlUsd: 10_000_000_000,
  maxSharePriceDrop: 0.05, // run over run
  maxSharePriceRise: 0.2,
  maxTotalTvlMove: 0.15, // day over day
  maxSourceCountDrop: 0.2, // day over day
};

export interface QualitySample {
  [k: string]: string | number | null;
}

export interface QualityCheck {
  key: string;
  label: string;
  ok: boolean;
  count: number;
  detail: string;
  samples: QualitySample[];
}

const SAMPLE_LIMIT = 5;
const usdM = (n: number) => `$${(n / 1e6).toFixed(1)}M`;

export async function runQualityChecks(now: Date = new Date()): Promise<QualityCheck[]> {
  const L = QUALITY_LIMITS;
  const dayAgo = new Date(now.getTime() - 24 * HOUR);
  const twoDaysAgo = new Date(now.getTime() - 48 * HOUR);
  const checks: QualityCheck[] = [];

  // ── Per-vault: APY range, TVL cap, share price run over run ────────────────
  // Only offending rows come back. APY is the stored netApy (apy when netApy is
  // null): createSnapshot sanitizes only the avg fields, so this is where a
  // broken source value lands.
  // Counted vaults only: a row already left out of the totals (stale, wrapper,
  // phantom) cannot skew a headline number, so it must not block the digest.
  const bad = await prisma.$queryRaw<
    {
      name: string;
      src: string;
      chainId: number;
      apy: number | null;
      tvl: number;
      sp: number;
      prevSp: number | null;
    }[]
  >`
    SELECT v.name, v."dataSource" AS src, v."chainId",
      COALESCE(s1."netApy", s1.apy) AS apy,
      s1."totalAssetsUsd" AS tvl, s1."sharePrice" AS sp, s0."sharePrice" AS "prevSp"
    FROM "Vault" v
    JOIN LATERAL (
      SELECT "netApy", apy, "totalAssetsUsd", "sharePrice", timestamp FROM "VaultSnapshot"
      WHERE "vaultId" = v.id ORDER BY timestamp DESC LIMIT 1
    ) s1 ON true
    LEFT JOIN LATERAL (
      SELECT "sharePrice" FROM "VaultSnapshot"
      WHERE "vaultId" = v.id AND timestamp < s1.timestamp ORDER BY timestamp DESC LIMIT 1
    ) s0 ON true
    WHERE v.active AND v."countInTotals" AND (
      COALESCE(s1."netApy", s1.apy) > ${L.maxNetApy}
      OR COALESCE(s1."netApy", s1.apy) < ${L.minNetApy}
      OR s1."totalAssetsUsd" > ${L.maxVaultTvlUsd}
      OR (s0."sharePrice" > 0 AND s1."sharePrice" > 0 AND (
        s1."sharePrice" / s0."sharePrice" < ${1 - L.maxSharePriceDrop}
        OR s1."sharePrice" / s0."sharePrice" > ${1 + L.maxSharePriceRise}))
    )
    ORDER BY s1."totalAssetsUsd" DESC`;

  const apyBad = bad.filter((r) => r.apy !== null && (r.apy > L.maxNetApy || r.apy < L.minNetApy));
  checks.push({
    key: "apy-range",
    label: "Net APY in range",
    ok: apyBad.length === 0,
    count: apyBad.length,
    detail: `${apyBad.length} counted vault(s) with net APY outside ${L.minNetApy * 100}%..${L.maxNetApy * 100}% (${usdM(
      apyBad.reduce((s, r) => s + r.tvl, 0)
    )} TVL)`,
    samples: apyBad.slice(0, SAMPLE_LIMIT).map((r) => ({ name: r.name, source: r.src, apy: r.apy, tvl: r.tvl })),
  });

  const tvlBad = bad.filter((r) => r.tvl > L.maxVaultTvlUsd);
  checks.push({
    key: "tvl-cap",
    label: "Vault TVL under $10B",
    ok: tvlBad.length === 0,
    count: tvlBad.length,
    detail: `${tvlBad.length} vault(s) above $${L.maxVaultTvlUsd / 1e9}B`,
    samples: tvlBad.slice(0, SAMPLE_LIMIT).map((r) => ({ name: r.name, source: r.src, tvl: r.tvl })),
  });

  const spBad = bad.filter((r) => {
    if (!r.prevSp || r.prevSp <= 0 || r.sp <= 0) return false;
    const ratio = r.sp / r.prevSp;
    return ratio < 1 - L.maxSharePriceDrop || ratio > 1 + L.maxSharePriceRise;
  });
  checks.push({
    key: "share-price",
    label: "Share price run over run",
    ok: spBad.length === 0,
    count: spBad.length,
    detail: `${spBad.length} vault(s) whose share price fell >${L.maxSharePriceDrop * 100}% or rose >${
      L.maxSharePriceRise * 100
    }% since the previous snapshot`,
    samples: spBad
      .slice(0, SAMPLE_LIMIT)
      .map((r) => ({ name: r.name, source: r.src, prevSharePrice: r.prevSp, sharePrice: r.sp })),
  });

  // ── Duplicate on-chain vaults across active rows ───────────────────────────
  const dupes = await prisma.$queryRaw<
    { chainId: number; addr: string; n: number; sources: string[]; names: string[] }[]
  >`
    SELECT "chainId", lower("onchainAddress") AS addr, count(*)::int AS n,
      array_agg(DISTINCT "dataSource") AS sources, array_agg(name) AS names
    FROM "Vault"
    WHERE active AND "onchainAddress" IS NOT NULL AND "onchainAddress" <> ''
    GROUP BY 1, 2 HAVING count(*) > 1
    ORDER BY count(*) DESC`;
  checks.push({
    key: "duplicates",
    label: "No duplicate on-chain vaults",
    ok: dupes.length === 0,
    count: dupes.length,
    detail: `${dupes.length} (chainId, address) pair(s) held by more than one active row (${dupes.reduce(
      (s, d) => s + d.n,
      0
    )} rows)`,
    samples: dupes.slice(0, SAMPLE_LIMIT).map((d) => ({
      chainId: d.chainId,
      address: d.addr,
      rows: d.n,
      sources: d.sources.join(","),
      names: d.names.join(" | "),
    })),
  });

  // ── Total TVL day over day ─────────────────────────────────────────────────
  // Same vault set on both sides (active today AND with a snapshot at least
  // 24h old): latest snapshot vs the latest one at least 24h old. Vaults new
  // in the window (a restored source's first run, a batch of launches) would
  // otherwise count on the current side only and read as a TVL jump.
  const [tvl] = await prisma.$queryRaw<{ cur: number | null; prev: number | null }[]>`
    SELECT sum(n.tvl) FILTER (WHERE p.tvl IS NOT NULL) AS cur, sum(p.tvl) AS prev
    FROM "Vault" v
    LEFT JOIN LATERAL (
      SELECT "totalAssetsUsd" AS tvl FROM "VaultSnapshot"
      WHERE "vaultId" = v.id ORDER BY timestamp DESC LIMIT 1
    ) n ON true
    LEFT JOIN LATERAL (
      SELECT "totalAssetsUsd" AS tvl FROM "VaultSnapshot"
      WHERE "vaultId" = v.id AND timestamp <= ${dayAgo} ORDER BY timestamp DESC LIMIT 1
    ) p ON true
    WHERE v.active`;
  const cur = tvl?.cur ?? 0;
  const prev = tvl?.prev ?? 0;
  const move = prev > 0 ? (cur - prev) / prev : 0;
  checks.push({
    key: "total-tvl",
    label: "Total TVL day over day",
    ok: Math.abs(move) <= L.maxTotalTvlMove,
    count: Math.abs(move) <= L.maxTotalTvlMove ? 0 : 1,
    detail: `total TVL ${usdM(prev)} -> ${usdM(cur)} (${(move * 100).toFixed(1)}%, limit ±${L.maxTotalTvlMove * 100}%)`,
    samples: [{ prevUsd: prev, curUsd: cur, movePct: Math.round(move * 1000) / 10 }],
  });

  // ── Vault count per source day over day ────────────────────────────────────
  // Vault has no history of its active flag, so this counts vaults REPORTING
  // (distinct vaults with a snapshot) in the last 24h vs the 24h before. Not
  // filtered on active: a mass deactivation must show as a drop too.
  const counts = await prisma.$queryRaw<{ src: string; is_v2: boolean; cur: number; prev: number }[]>`
    SELECT v."dataSource" AS src,
      (v."dataSource" = 'morpho' AND EXISTS (
        SELECT 1 FROM "VaultRiskSnapshot" r WHERE r."vaultId" = v.id)) AS is_v2,
      count(DISTINCT s."vaultId") FILTER (WHERE s.timestamp > ${dayAgo})::int AS cur,
      count(DISTINCT s."vaultId") FILTER (WHERE s.timestamp <= ${dayAgo})::int AS prev
    FROM "VaultSnapshot" s JOIN "Vault" v ON v.id = s."vaultId"
    WHERE s.timestamp > ${twoDaysAgo}
    GROUP BY 1, 2`;
  const bySource = new Map<string, { cur: number; prev: number }>();
  for (const c of counts) {
    const key = vaultSourceKey(c.src, c.is_v2);
    const e = bySource.get(key) ?? { cur: 0, prev: 0 };
    e.cur += c.cur;
    e.prev += c.prev;
    bySource.set(key, e);
  }
  for (const [source, { cur: n, prev: p }] of [...bySource.entries()].sort()) {
    const drop = p > 0 ? (p - n) / p : 0;
    const ok = drop <= L.maxSourceCountDrop;
    checks.push({
      key: `source-count:${source}`,
      label: `${source} vaults reporting`,
      ok,
      count: ok ? 0 : p - n,
      detail: `${source}: ${p} -> ${n} vaults reporting day over day (${(-drop * 100).toFixed(0)}%, limit -${
        L.maxSourceCountDrop * 100
      }%)`,
      samples: [{ source, prev: p, cur: n }],
    });
  }

  return checks;
}

export function qualityBreaches(checks: QualityCheck[]): HealthBreach[] {
  return checks
    .filter((c) => !c.ok)
    .map((c) => ({ key: `quality:${c.key}`, kind: "quality" as const, message: `${c.label}: ${c.detail}` }));
}

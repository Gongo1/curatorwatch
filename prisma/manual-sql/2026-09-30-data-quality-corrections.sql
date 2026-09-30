-- ============================================================================
-- One-time data-quality correction (PR "Data quality: dedupe wrappers/bridged/
-- nested, phantom guard, stale exclusion, launch detector"). NOT executed by
-- the PR author: preview with Part A (read-only), then apply Part B.
--
-- Prerequisites, in order:
--   1. prisma/manual-sql/2026-09-30-vault-count-in-totals.sql is applied.
--   2. The restored feeds (PR #66) are deployed AND every collector has run
--      green at least once, so Turtle / Morpho V2 / Euler / Upshift rows have
--      fresh snapshots. Rows with no snapshot in the last 7 days are NOT
--      counted, so applying this while a feed is still broken hides that feed's
--      TVL until it recovers.
--   3. Apply Part B, then merge + deploy this PR right away.
--
-- Part B, in one transaction, idempotent (re-running changes nothing):
--   1. Backfill Vault.lastSnapshotAt from the latest VaultSnapshot.
--   2. Fix the 11 Lido wstETH Turtle rows labeled Ethereum that live on L2s
--      (chainId from the receipt token, same as the fixed collector).
--   3. Flag phantom-accrual vaults (latest snapshot: apy/netApy > 2, stablecoin
--      share price > 5, or assets +20% in 30d with supply < 2%). Set-only; the
--      collectors clear the flag when a vault recovers.
--   4. Apply the double-count rules (src/lib/data-quality/exclusion-rules.ts):
--      cross_source_dup, wrapper (config + same-curator wX/X, sX/X), bridged,
--      nested, unlisted. Mirrors classifyExclusions() exactly.
--   5. Null impossible APYs (|value| > 2 = 200%) on every VaultSnapshot.
--   6. Delete VAULT_LAUNCH VaultChange rows for vaults created more than 30 days
--      before the alert (old vaults crossing $1M, not launches).
--   7. Recompute Curator.vaultCount / totalAssetsManaged over counted vaults
--      (same statement as updateCuratorStats() in the new code).
-- The collectors keep all of this current after deploy; this file only makes
-- the site correct from the first request.
-- ============================================================================

-- ─── Part A: preview (read-only) ────────────────────────────────────────────

-- A1. Headline totals, before vs after. "before" = what the directory sums
-- today (every vault of every directory curator, latest snapshot).
WITH
lido_fix(turtle_id, chain_id, chain_name) AS (VALUES
  ('6b6321e3-0357-4b11-a297-015dbd1b7e34', 42161,  'Arbitrum'),
  ('9d5bab36-0628-4702-aed0-e6a6953610b1', 56,     'BNB Chain'),
  ('b6bf9077-ed5c-4184-a03e-c4e9072fc021', 59144,  'Linea'),
  ('4c4c8936-d009-44c1-9bb3-e3ec59cf3671', 130,    'Unichain'),
  ('1d0eab50-ac81-41db-9f74-001d3016d0ac', 137,    'Polygon'),
  ('3181ee89-48e1-4a1c-ba63-38834d41030b', 4326,   'Unknown'),
  ('b5751d7a-7336-40e5-9767-62e5c387fe01', 8453,   'Base'),
  ('06270767-7f65-477d-b4cb-eb00db074f80', 143,    'Monad'),
  ('f177c174-8677-4055-a6d6-2f0e6b96bbe1', 10,     'Optimism'),
  ('d021b20b-2a61-48f7-85c8-137e802ff411', 100,    'Gnosis'),
  ('6f76c8ea-2d81-424e-bd7b-1e67f2b7f828', 747474, 'Katana')
),
params AS (
  SELECT (now() AT TIME ZONE 'UTC') - interval '7 days' AS fresh_cutoff
),
v AS (
  SELECT v.id, v.name, v."dataSource", v.active, v.listed, v."curatorId",
         lower(v.address) AS addr, v."onchainAddress" AS oa, v."assetSymbol",
         COALESCE(v."onchainSymbol", v.symbol) AS sym,
         COALESCE(lf.chain_id, v."chainId") AS chain_id,
         lf.chain_name AS lido_chain_name,
         v."excludeReason" AS cur_reason,
         COALESCE(c.address NOT LIKE 'turtle-%'
                  AND COALESCE(c.name, '') NOT IN ('Maxshot', 'Duplicated Key', 'Unified Test'),
                  false) AS directory_curator,
         ls.ts AS last_ts, COALESCE(ls.tvl, 0) AS tvl, ls.apy, ls.net_apy, ls.share_price,
         ls.total_assets, ls.total_supply, bs.base_assets, bs.base_supply
  FROM "Vault" v
  LEFT JOIN "Curator" c ON c.id = v."curatorId"
  LEFT JOIN lido_fix lf ON lf.turtle_id = v."turtleId"
  LEFT JOIN LATERAL (
    SELECT s."timestamp" AS ts, s."totalAssetsUsd" AS tvl, s.apy, s."netApy" AS net_apy,
           s."sharePrice" AS share_price, s."totalAssets" AS total_assets, s."totalSupply" AS total_supply
    FROM "VaultSnapshot" s WHERE s."vaultId" = v.id
    ORDER BY s."timestamp" DESC LIMIT 1
  ) ls ON true
  LEFT JOIN LATERAL (
    SELECT b."totalAssets" AS base_assets, b."totalSupply" AS base_supply
    FROM "VaultSnapshot" b
    WHERE b."vaultId" = v.id
      AND b."timestamp" <= ls.ts - interval '30 days'
      AND b."timestamp" >= ls.ts - interval '37 days'
    ORDER BY b."timestamp" DESC LIMIT 1
  ) bs ON true
),
ph AS (
  SELECT v.*,
    CASE
      WHEN v.apy > 2 OR v.net_apy > 2 THEN 'apy > 2'
      WHEN (upper(v."assetSymbol") LIKE '%USD%'
            OR upper(v."assetSymbol") IN ('DAI','SDAI','EURC','EURCV','EURE','EURS','AGEUR','CEUR',
                                          'EURA','TGBP','GBPT','BOLD','SBOLD','USR','GHO','FRAX'))
           AND v.share_price > 5 THEN 'stablecoin share price > 5'
      WHEN v.total_assets ~ '^[0-9]+$' AND v.total_supply ~ '^[0-9]+$'
           AND v.base_assets ~ '^[0-9]+$' AND v.base_supply ~ '^[0-9]+$'
           AND v.total_assets::numeric > 0 AND v.total_supply::numeric > 0
           AND v.base_assets::numeric > 0 AND v.base_supply::numeric > 0
           AND (v.total_assets::numeric - v.base_assets::numeric) / v.base_assets::numeric > 0.2
           AND abs(v.total_supply::numeric - v.base_supply::numeric) / v.base_supply::numeric < 0.02
        THEN 'assets +20%/30d, supply <2%'
    END AS phantom_why
  FROM v
),
native AS (
  SELECT n.addr, n.oa, n.chain_id, n."dataSource"
  FROM v n, params
  WHERE n.active
    AND n."dataSource" IN ('morpho', 'euler', 'upshift', 'fund', 'hyperliquid')
    AND n.last_ts >= params.fresh_cutoff
),
ruled AS (
  SELECT ph.*,
    CASE
      WHEN ph."dataSource" = 'turtle' AND ph.oa IS NOT NULL AND EXISTS (
             SELECT 1 FROM native n
             WHERE (n.addr = ph.oa OR n.oa = ph.oa)
               AND (n.chain_id = ph.chain_id OR n."dataSource" = 'fund'))
        THEN 'cross_source_dup'
      WHEN ph.sym IN ('weETH', 'wrsETH') THEN 'wrapper'
      WHEN ph."curatorId" IS NOT NULL AND length(ph.sym) > 2 AND left(ph.sym, 1) IN ('w', 's')
           AND EXISTS (SELECT 1 FROM v b
                       WHERE b.active AND b.listed AND b."curatorId" = ph."curatorId"
                         AND b.sym = substr(ph.sym, 2))
        THEN 'wrapper'
      WHEN (ph.sym = 'sUSDS' AND ph.chain_id <> 1) OR (ph.sym = 'sUSDe' AND ph.chain_id <> 1)
        OR (ph.sym = 'sUSDai' AND ph.chain_id <> 42161) OR (ph.sym = 'rsETH' AND ph.chain_id <> 1)
        THEN 'bridged'
      WHEN ph.sym IN ('spweETH', 'spwstETH') THEN 'nested'
      WHEN NOT ph.listed THEN 'unlisted'
    END AS rule_reason
  FROM ph
),
plan AS (
  SELECT r.*,
    CASE WHEN r.cur_reason = 'phantom' OR r.phantom_why IS NOT NULL THEN 'phantom'
         ELSE r.rule_reason END AS new_reason,
    CASE WHEN NOT r.active THEN 'inactive'
         WHEN r.cur_reason = 'phantom' OR r.phantom_why IS NOT NULL THEN 'phantom'
         WHEN r.rule_reason IS NOT NULL THEN r.rule_reason
         WHEN r.last_ts IS NULL OR r.last_ts < (SELECT fresh_cutoff FROM params) THEN 'stale'
         ELSE 'counted' END AS status_after
  FROM ruled r
)
SELECT
  round((SUM(tvl) FILTER (WHERE directory_curator) / 1e9)::numeric, 3)                               AS before_directory_tvl_b,
  count(*) FILTER (WHERE directory_curator)                                                          AS before_directory_vaults,
  round((SUM(tvl) FILTER (WHERE directory_curator AND status_after = 'counted') / 1e9)::numeric, 3)  AS after_counted_tvl_b,
  count(*) FILTER (WHERE directory_curator AND status_after = 'counted')                             AS after_counted_vaults
FROM plan;

-- A2. Where the difference goes: TVL by status after the correction.
WITH
lido_fix(turtle_id, chain_id, chain_name) AS (VALUES
  ('6b6321e3-0357-4b11-a297-015dbd1b7e34', 42161,  'Arbitrum'),
  ('9d5bab36-0628-4702-aed0-e6a6953610b1', 56,     'BNB Chain'),
  ('b6bf9077-ed5c-4184-a03e-c4e9072fc021', 59144,  'Linea'),
  ('4c4c8936-d009-44c1-9bb3-e3ec59cf3671', 130,    'Unichain'),
  ('1d0eab50-ac81-41db-9f74-001d3016d0ac', 137,    'Polygon'),
  ('3181ee89-48e1-4a1c-ba63-38834d41030b', 4326,   'Unknown'),
  ('b5751d7a-7336-40e5-9767-62e5c387fe01', 8453,   'Base'),
  ('06270767-7f65-477d-b4cb-eb00db074f80', 143,    'Monad'),
  ('f177c174-8677-4055-a6d6-2f0e6b96bbe1', 10,     'Optimism'),
  ('d021b20b-2a61-48f7-85c8-137e802ff411', 100,    'Gnosis'),
  ('6f76c8ea-2d81-424e-bd7b-1e67f2b7f828', 747474, 'Katana')
),
params AS (
  SELECT (now() AT TIME ZONE 'UTC') - interval '7 days' AS fresh_cutoff
),
v AS (
  SELECT v.id, v.name, v."dataSource", v.active, v.listed, v."curatorId",
         lower(v.address) AS addr, v."onchainAddress" AS oa, v."assetSymbol",
         COALESCE(v."onchainSymbol", v.symbol) AS sym,
         COALESCE(lf.chain_id, v."chainId") AS chain_id,
         lf.chain_name AS lido_chain_name,
         v."excludeReason" AS cur_reason,
         COALESCE(c.address NOT LIKE 'turtle-%'
                  AND COALESCE(c.name, '') NOT IN ('Maxshot', 'Duplicated Key', 'Unified Test'),
                  false) AS directory_curator,
         ls.ts AS last_ts, COALESCE(ls.tvl, 0) AS tvl, ls.apy, ls.net_apy, ls.share_price,
         ls.total_assets, ls.total_supply, bs.base_assets, bs.base_supply
  FROM "Vault" v
  LEFT JOIN "Curator" c ON c.id = v."curatorId"
  LEFT JOIN lido_fix lf ON lf.turtle_id = v."turtleId"
  LEFT JOIN LATERAL (
    SELECT s."timestamp" AS ts, s."totalAssetsUsd" AS tvl, s.apy, s."netApy" AS net_apy,
           s."sharePrice" AS share_price, s."totalAssets" AS total_assets, s."totalSupply" AS total_supply
    FROM "VaultSnapshot" s WHERE s."vaultId" = v.id
    ORDER BY s."timestamp" DESC LIMIT 1
  ) ls ON true
  LEFT JOIN LATERAL (
    SELECT b."totalAssets" AS base_assets, b."totalSupply" AS base_supply
    FROM "VaultSnapshot" b
    WHERE b."vaultId" = v.id
      AND b."timestamp" <= ls.ts - interval '30 days'
      AND b."timestamp" >= ls.ts - interval '37 days'
    ORDER BY b."timestamp" DESC LIMIT 1
  ) bs ON true
),
ph AS (
  SELECT v.*,
    CASE
      WHEN v.apy > 2 OR v.net_apy > 2 THEN 'apy > 2'
      WHEN (upper(v."assetSymbol") LIKE '%USD%'
            OR upper(v."assetSymbol") IN ('DAI','SDAI','EURC','EURCV','EURE','EURS','AGEUR','CEUR',
                                          'EURA','TGBP','GBPT','BOLD','SBOLD','USR','GHO','FRAX'))
           AND v.share_price > 5 THEN 'stablecoin share price > 5'
      WHEN v.total_assets ~ '^[0-9]+$' AND v.total_supply ~ '^[0-9]+$'
           AND v.base_assets ~ '^[0-9]+$' AND v.base_supply ~ '^[0-9]+$'
           AND v.total_assets::numeric > 0 AND v.total_supply::numeric > 0
           AND v.base_assets::numeric > 0 AND v.base_supply::numeric > 0
           AND (v.total_assets::numeric - v.base_assets::numeric) / v.base_assets::numeric > 0.2
           AND abs(v.total_supply::numeric - v.base_supply::numeric) / v.base_supply::numeric < 0.02
        THEN 'assets +20%/30d, supply <2%'
    END AS phantom_why
  FROM v
),
native AS (
  SELECT n.addr, n.oa, n.chain_id, n."dataSource"
  FROM v n, params
  WHERE n.active
    AND n."dataSource" IN ('morpho', 'euler', 'upshift', 'fund', 'hyperliquid')
    AND n.last_ts >= params.fresh_cutoff
),
ruled AS (
  SELECT ph.*,
    CASE
      WHEN ph."dataSource" = 'turtle' AND ph.oa IS NOT NULL AND EXISTS (
             SELECT 1 FROM native n
             WHERE (n.addr = ph.oa OR n.oa = ph.oa)
               AND (n.chain_id = ph.chain_id OR n."dataSource" = 'fund'))
        THEN 'cross_source_dup'
      WHEN ph.sym IN ('weETH', 'wrsETH') THEN 'wrapper'
      WHEN ph."curatorId" IS NOT NULL AND length(ph.sym) > 2 AND left(ph.sym, 1) IN ('w', 's')
           AND EXISTS (SELECT 1 FROM v b
                       WHERE b.active AND b.listed AND b."curatorId" = ph."curatorId"
                         AND b.sym = substr(ph.sym, 2))
        THEN 'wrapper'
      WHEN (ph.sym = 'sUSDS' AND ph.chain_id <> 1) OR (ph.sym = 'sUSDe' AND ph.chain_id <> 1)
        OR (ph.sym = 'sUSDai' AND ph.chain_id <> 42161) OR (ph.sym = 'rsETH' AND ph.chain_id <> 1)
        THEN 'bridged'
      WHEN ph.sym IN ('spweETH', 'spwstETH') THEN 'nested'
      WHEN NOT ph.listed THEN 'unlisted'
    END AS rule_reason
  FROM ph
),
plan AS (
  SELECT r.*,
    CASE WHEN r.cur_reason = 'phantom' OR r.phantom_why IS NOT NULL THEN 'phantom'
         ELSE r.rule_reason END AS new_reason,
    CASE WHEN NOT r.active THEN 'inactive'
         WHEN r.cur_reason = 'phantom' OR r.phantom_why IS NOT NULL THEN 'phantom'
         WHEN r.rule_reason IS NOT NULL THEN r.rule_reason
         WHEN r.last_ts IS NULL OR r.last_ts < (SELECT fresh_cutoff FROM params) THEN 'stale'
         ELSE 'counted' END AS status_after
  FROM ruled r
)
SELECT status_after, count(*) AS vaults, round((SUM(tvl) / 1e6)::numeric, 1) AS tvl_m
FROM plan WHERE directory_curator
GROUP BY status_after ORDER BY SUM(tvl) DESC;

-- A3. Rows whose flag changes (largest first).
WITH
lido_fix(turtle_id, chain_id, chain_name) AS (VALUES
  ('6b6321e3-0357-4b11-a297-015dbd1b7e34', 42161,  'Arbitrum'),
  ('9d5bab36-0628-4702-aed0-e6a6953610b1', 56,     'BNB Chain'),
  ('b6bf9077-ed5c-4184-a03e-c4e9072fc021', 59144,  'Linea'),
  ('4c4c8936-d009-44c1-9bb3-e3ec59cf3671', 130,    'Unichain'),
  ('1d0eab50-ac81-41db-9f74-001d3016d0ac', 137,    'Polygon'),
  ('3181ee89-48e1-4a1c-ba63-38834d41030b', 4326,   'Unknown'),
  ('b5751d7a-7336-40e5-9767-62e5c387fe01', 8453,   'Base'),
  ('06270767-7f65-477d-b4cb-eb00db074f80', 143,    'Monad'),
  ('f177c174-8677-4055-a6d6-2f0e6b96bbe1', 10,     'Optimism'),
  ('d021b20b-2a61-48f7-85c8-137e802ff411', 100,    'Gnosis'),
  ('6f76c8ea-2d81-424e-bd7b-1e67f2b7f828', 747474, 'Katana')
),
params AS (
  SELECT (now() AT TIME ZONE 'UTC') - interval '7 days' AS fresh_cutoff
),
v AS (
  SELECT v.id, v.name, v."dataSource", v.active, v.listed, v."curatorId",
         lower(v.address) AS addr, v."onchainAddress" AS oa, v."assetSymbol",
         COALESCE(v."onchainSymbol", v.symbol) AS sym,
         COALESCE(lf.chain_id, v."chainId") AS chain_id,
         lf.chain_name AS lido_chain_name,
         v."excludeReason" AS cur_reason,
         COALESCE(c.address NOT LIKE 'turtle-%'
                  AND COALESCE(c.name, '') NOT IN ('Maxshot', 'Duplicated Key', 'Unified Test'),
                  false) AS directory_curator,
         ls.ts AS last_ts, COALESCE(ls.tvl, 0) AS tvl, ls.apy, ls.net_apy, ls.share_price,
         ls.total_assets, ls.total_supply, bs.base_assets, bs.base_supply
  FROM "Vault" v
  LEFT JOIN "Curator" c ON c.id = v."curatorId"
  LEFT JOIN lido_fix lf ON lf.turtle_id = v."turtleId"
  LEFT JOIN LATERAL (
    SELECT s."timestamp" AS ts, s."totalAssetsUsd" AS tvl, s.apy, s."netApy" AS net_apy,
           s."sharePrice" AS share_price, s."totalAssets" AS total_assets, s."totalSupply" AS total_supply
    FROM "VaultSnapshot" s WHERE s."vaultId" = v.id
    ORDER BY s."timestamp" DESC LIMIT 1
  ) ls ON true
  LEFT JOIN LATERAL (
    SELECT b."totalAssets" AS base_assets, b."totalSupply" AS base_supply
    FROM "VaultSnapshot" b
    WHERE b."vaultId" = v.id
      AND b."timestamp" <= ls.ts - interval '30 days'
      AND b."timestamp" >= ls.ts - interval '37 days'
    ORDER BY b."timestamp" DESC LIMIT 1
  ) bs ON true
),
ph AS (
  SELECT v.*,
    CASE
      WHEN v.apy > 2 OR v.net_apy > 2 THEN 'apy > 2'
      WHEN (upper(v."assetSymbol") LIKE '%USD%'
            OR upper(v."assetSymbol") IN ('DAI','SDAI','EURC','EURCV','EURE','EURS','AGEUR','CEUR',
                                          'EURA','TGBP','GBPT','BOLD','SBOLD','USR','GHO','FRAX'))
           AND v.share_price > 5 THEN 'stablecoin share price > 5'
      WHEN v.total_assets ~ '^[0-9]+$' AND v.total_supply ~ '^[0-9]+$'
           AND v.base_assets ~ '^[0-9]+$' AND v.base_supply ~ '^[0-9]+$'
           AND v.total_assets::numeric > 0 AND v.total_supply::numeric > 0
           AND v.base_assets::numeric > 0 AND v.base_supply::numeric > 0
           AND (v.total_assets::numeric - v.base_assets::numeric) / v.base_assets::numeric > 0.2
           AND abs(v.total_supply::numeric - v.base_supply::numeric) / v.base_supply::numeric < 0.02
        THEN 'assets +20%/30d, supply <2%'
    END AS phantom_why
  FROM v
),
native AS (
  SELECT n.addr, n.oa, n.chain_id, n."dataSource"
  FROM v n, params
  WHERE n.active
    AND n."dataSource" IN ('morpho', 'euler', 'upshift', 'fund', 'hyperliquid')
    AND n.last_ts >= params.fresh_cutoff
),
ruled AS (
  SELECT ph.*,
    CASE
      WHEN ph."dataSource" = 'turtle' AND ph.oa IS NOT NULL AND EXISTS (
             SELECT 1 FROM native n
             WHERE (n.addr = ph.oa OR n.oa = ph.oa)
               AND (n.chain_id = ph.chain_id OR n."dataSource" = 'fund'))
        THEN 'cross_source_dup'
      WHEN ph.sym IN ('weETH', 'wrsETH') THEN 'wrapper'
      WHEN ph."curatorId" IS NOT NULL AND length(ph.sym) > 2 AND left(ph.sym, 1) IN ('w', 's')
           AND EXISTS (SELECT 1 FROM v b
                       WHERE b.active AND b.listed AND b."curatorId" = ph."curatorId"
                         AND b.sym = substr(ph.sym, 2))
        THEN 'wrapper'
      WHEN (ph.sym = 'sUSDS' AND ph.chain_id <> 1) OR (ph.sym = 'sUSDe' AND ph.chain_id <> 1)
        OR (ph.sym = 'sUSDai' AND ph.chain_id <> 42161) OR (ph.sym = 'rsETH' AND ph.chain_id <> 1)
        THEN 'bridged'
      WHEN ph.sym IN ('spweETH', 'spwstETH') THEN 'nested'
      WHEN NOT ph.listed THEN 'unlisted'
    END AS rule_reason
  FROM ph
),
plan AS (
  SELECT r.*,
    CASE WHEN r.cur_reason = 'phantom' OR r.phantom_why IS NOT NULL THEN 'phantom'
         ELSE r.rule_reason END AS new_reason,
    CASE WHEN NOT r.active THEN 'inactive'
         WHEN r.cur_reason = 'phantom' OR r.phantom_why IS NOT NULL THEN 'phantom'
         WHEN r.rule_reason IS NOT NULL THEN r.rule_reason
         WHEN r.last_ts IS NULL OR r.last_ts < (SELECT fresh_cutoff FROM params) THEN 'stale'
         ELSE 'counted' END AS status_after
  FROM ruled r
)
SELECT p.name, p."dataSource", p.chain_id, p.sym, round((p.tvl / 1e6)::numeric, 1) AS tvl_m,
       p.cur_reason, p.new_reason, p.phantom_why, p.last_ts::date AS last_snapshot
FROM plan p
WHERE p.new_reason IS DISTINCT FROM p.cur_reason
ORDER BY p.tvl DESC
LIMIT 100;

-- A4. Lido wstETH rows whose chain gets fixed.
SELECT id, "turtleId", name, "chainId", "chainName", "onchainAddress"
FROM "Vault"
WHERE "dataSource" = 'turtle' AND "onchainSymbol" = 'wstETH' AND "chainId" = 1
  AND "onchainAddress" <> '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0';

-- A5. Snapshots with impossible APYs, and stale VAULT_LAUNCH alerts.
SELECT
  (SELECT count(*) FROM "VaultSnapshot"
    WHERE abs(apy) > 2 OR abs("netApy") > 2 OR abs("avgApy") > 2 OR abs("avgNetApy") > 2) AS snapshots_with_bad_apy,
  (SELECT count(*) FROM "VaultChange" c JOIN "Vault" v ON v.id = c."vaultId"
    WHERE c."changeType" = 'VAULT_LAUNCH'
      AND COALESCE(to_timestamp(v."creationTimestamp") AT TIME ZONE 'UTC',
                   (SELECT min(s."timestamp") FROM "VaultSnapshot" s WHERE s."vaultId" = v.id))
          < c."detectedAt" - interval '30 days') AS stale_launch_alerts,
  (SELECT count(*) FROM "VaultChange" WHERE "changeType" = 'VAULT_LAUNCH') AS all_launch_alerts;

-- ─── Part B: apply (one transaction) ────────────────────────────────────────
BEGIN;

CREATE TEMP TABLE dq_plan ON COMMIT DROP AS
WITH
lido_fix(turtle_id, chain_id, chain_name) AS (VALUES
  ('6b6321e3-0357-4b11-a297-015dbd1b7e34', 42161,  'Arbitrum'),
  ('9d5bab36-0628-4702-aed0-e6a6953610b1', 56,     'BNB Chain'),
  ('b6bf9077-ed5c-4184-a03e-c4e9072fc021', 59144,  'Linea'),
  ('4c4c8936-d009-44c1-9bb3-e3ec59cf3671', 130,    'Unichain'),
  ('1d0eab50-ac81-41db-9f74-001d3016d0ac', 137,    'Polygon'),
  ('3181ee89-48e1-4a1c-ba63-38834d41030b', 4326,   'Unknown'),
  ('b5751d7a-7336-40e5-9767-62e5c387fe01', 8453,   'Base'),
  ('06270767-7f65-477d-b4cb-eb00db074f80', 143,    'Monad'),
  ('f177c174-8677-4055-a6d6-2f0e6b96bbe1', 10,     'Optimism'),
  ('d021b20b-2a61-48f7-85c8-137e802ff411', 100,    'Gnosis'),
  ('6f76c8ea-2d81-424e-bd7b-1e67f2b7f828', 747474, 'Katana')
),
params AS (
  SELECT (now() AT TIME ZONE 'UTC') - interval '7 days' AS fresh_cutoff
),
v AS (
  SELECT v.id, v.name, v."dataSource", v.active, v.listed, v."curatorId",
         lower(v.address) AS addr, v."onchainAddress" AS oa, v."assetSymbol",
         COALESCE(v."onchainSymbol", v.symbol) AS sym,
         COALESCE(lf.chain_id, v."chainId") AS chain_id,
         lf.chain_name AS lido_chain_name,
         v."excludeReason" AS cur_reason,
         COALESCE(c.address NOT LIKE 'turtle-%'
                  AND COALESCE(c.name, '') NOT IN ('Maxshot', 'Duplicated Key', 'Unified Test'),
                  false) AS directory_curator,
         ls.ts AS last_ts, COALESCE(ls.tvl, 0) AS tvl, ls.apy, ls.net_apy, ls.share_price,
         ls.total_assets, ls.total_supply, bs.base_assets, bs.base_supply
  FROM "Vault" v
  LEFT JOIN "Curator" c ON c.id = v."curatorId"
  LEFT JOIN lido_fix lf ON lf.turtle_id = v."turtleId"
  LEFT JOIN LATERAL (
    SELECT s."timestamp" AS ts, s."totalAssetsUsd" AS tvl, s.apy, s."netApy" AS net_apy,
           s."sharePrice" AS share_price, s."totalAssets" AS total_assets, s."totalSupply" AS total_supply
    FROM "VaultSnapshot" s WHERE s."vaultId" = v.id
    ORDER BY s."timestamp" DESC LIMIT 1
  ) ls ON true
  LEFT JOIN LATERAL (
    SELECT b."totalAssets" AS base_assets, b."totalSupply" AS base_supply
    FROM "VaultSnapshot" b
    WHERE b."vaultId" = v.id
      AND b."timestamp" <= ls.ts - interval '30 days'
      AND b."timestamp" >= ls.ts - interval '37 days'
    ORDER BY b."timestamp" DESC LIMIT 1
  ) bs ON true
),
ph AS (
  SELECT v.*,
    CASE
      WHEN v.apy > 2 OR v.net_apy > 2 THEN 'apy > 2'
      WHEN (upper(v."assetSymbol") LIKE '%USD%'
            OR upper(v."assetSymbol") IN ('DAI','SDAI','EURC','EURCV','EURE','EURS','AGEUR','CEUR',
                                          'EURA','TGBP','GBPT','BOLD','SBOLD','USR','GHO','FRAX'))
           AND v.share_price > 5 THEN 'stablecoin share price > 5'
      WHEN v.total_assets ~ '^[0-9]+$' AND v.total_supply ~ '^[0-9]+$'
           AND v.base_assets ~ '^[0-9]+$' AND v.base_supply ~ '^[0-9]+$'
           AND v.total_assets::numeric > 0 AND v.total_supply::numeric > 0
           AND v.base_assets::numeric > 0 AND v.base_supply::numeric > 0
           AND (v.total_assets::numeric - v.base_assets::numeric) / v.base_assets::numeric > 0.2
           AND abs(v.total_supply::numeric - v.base_supply::numeric) / v.base_supply::numeric < 0.02
        THEN 'assets +20%/30d, supply <2%'
    END AS phantom_why
  FROM v
),
native AS (
  SELECT n.addr, n.oa, n.chain_id, n."dataSource"
  FROM v n, params
  WHERE n.active
    AND n."dataSource" IN ('morpho', 'euler', 'upshift', 'fund', 'hyperliquid')
    AND n.last_ts >= params.fresh_cutoff
),
ruled AS (
  SELECT ph.*,
    CASE
      WHEN ph."dataSource" = 'turtle' AND ph.oa IS NOT NULL AND EXISTS (
             SELECT 1 FROM native n
             WHERE (n.addr = ph.oa OR n.oa = ph.oa)
               AND (n.chain_id = ph.chain_id OR n."dataSource" = 'fund'))
        THEN 'cross_source_dup'
      WHEN ph.sym IN ('weETH', 'wrsETH') THEN 'wrapper'
      WHEN ph."curatorId" IS NOT NULL AND length(ph.sym) > 2 AND left(ph.sym, 1) IN ('w', 's')
           AND EXISTS (SELECT 1 FROM v b
                       WHERE b.active AND b.listed AND b."curatorId" = ph."curatorId"
                         AND b.sym = substr(ph.sym, 2))
        THEN 'wrapper'
      WHEN (ph.sym = 'sUSDS' AND ph.chain_id <> 1) OR (ph.sym = 'sUSDe' AND ph.chain_id <> 1)
        OR (ph.sym = 'sUSDai' AND ph.chain_id <> 42161) OR (ph.sym = 'rsETH' AND ph.chain_id <> 1)
        THEN 'bridged'
      WHEN ph.sym IN ('spweETH', 'spwstETH') THEN 'nested'
      WHEN NOT ph.listed THEN 'unlisted'
    END AS rule_reason
  FROM ph
),
plan AS (
  SELECT r.*,
    CASE WHEN r.cur_reason = 'phantom' OR r.phantom_why IS NOT NULL THEN 'phantom'
         ELSE r.rule_reason END AS new_reason,
    CASE WHEN NOT r.active THEN 'inactive'
         WHEN r.cur_reason = 'phantom' OR r.phantom_why IS NOT NULL THEN 'phantom'
         WHEN r.rule_reason IS NOT NULL THEN r.rule_reason
         WHEN r.last_ts IS NULL OR r.last_ts < (SELECT fresh_cutoff FROM params) THEN 'stale'
         ELSE 'counted' END AS status_after
  FROM ruled r
)
SELECT id, chain_id, lido_chain_name, last_ts, phantom_why, new_reason FROM plan;

-- B1. lastSnapshotAt backfill (NULL or older than the latest snapshot).
UPDATE "Vault" v
SET "lastSnapshotAt" = p.last_ts
FROM dq_plan p
WHERE v.id = p.id AND p.last_ts IS NOT NULL
  AND (v."lastSnapshotAt" IS NULL OR v."lastSnapshotAt" < p.last_ts);

-- B2. Lido wstETH L2 rows: chain from the receipt token.
UPDATE "Vault" v
SET "chainId" = p.chain_id, "chainName" = p.lido_chain_name, "updatedAt" = now() AT TIME ZONE 'UTC'
FROM dq_plan p
WHERE v.id = p.id AND p.lido_chain_name IS NOT NULL AND v."chainId" <> p.chain_id;

-- B3. Phantom accrual (set-only).
UPDATE "Vault" v
SET "excludeReason" = 'phantom', "countInTotals" = false
FROM dq_plan p
WHERE v.id = p.id AND p.phantom_why IS NOT NULL
  AND (v."excludeReason" IS DISTINCT FROM 'phantom' OR v."countInTotals");

-- B4. Double-count rules (never touches phantom rows).
UPDATE "Vault" v
SET "excludeReason" = p.new_reason, "countInTotals" = (p.new_reason IS NULL)
FROM dq_plan p
WHERE v.id = p.id
  AND p.new_reason IS DISTINCT FROM 'phantom'
  AND v."excludeReason" IS DISTINCT FROM 'phantom'
  AND (v."excludeReason" IS DISTINCT FROM p.new_reason OR v."countInTotals" <> (p.new_reason IS NULL));

-- B5. Null impossible APYs (> 200%) in snapshot history.
UPDATE "VaultSnapshot"
SET apy         = CASE WHEN abs(apy) > 2 THEN NULL ELSE apy END,
    "netApy"    = CASE WHEN abs("netApy") > 2 THEN NULL ELSE "netApy" END,
    "avgApy"    = CASE WHEN abs("avgApy") > 2 THEN NULL ELSE "avgApy" END,
    "avgNetApy" = CASE WHEN abs("avgNetApy") > 2 THEN NULL ELSE "avgNetApy" END
WHERE abs(apy) > 2 OR abs("netApy") > 2 OR abs("avgApy") > 2 OR abs("avgNetApy") > 2;

-- B6. Stale VAULT_LAUNCH alerts (vault created > 30 days before the alert).
DELETE FROM "VaultChange" c
USING "Vault" v
WHERE v.id = c."vaultId"
  AND c."changeType" = 'VAULT_LAUNCH'
  AND COALESCE(to_timestamp(v."creationTimestamp") AT TIME ZONE 'UTC',
               (SELECT min(s."timestamp") FROM "VaultSnapshot" s WHERE s."vaultId" = v.id))
      < c."detectedAt" - interval '30 days';

-- B7. Curator stats over counted vaults (= updateCuratorStats()).
UPDATE "Curator" c
SET "vaultCount" = agg.vault_count,
    "totalAssetsManaged" = agg.total_assets,
    "updatedAt" = now() AT TIME ZONE 'UTC'
FROM (
  SELECT v."curatorId",
         COUNT(latest.tvl)::int AS vault_count,
         COALESCE(SUM(latest.tvl), 0) AS total_assets
  FROM "Vault" v
  LEFT JOIN LATERAL (
    SELECT s."totalAssetsUsd" AS tvl
    FROM "VaultSnapshot" s
    WHERE s."vaultId" = v.id
    ORDER BY s."timestamp" DESC
    LIMIT 1
  ) latest ON v.active AND v.listed AND v."countInTotals"
              AND v."lastSnapshotAt" >= (now() AT TIME ZONE 'UTC') - interval '7 days'
  WHERE v."curatorId" IS NOT NULL
  GROUP BY v."curatorId"
) agg
WHERE c.id = agg."curatorId";

-- Post-check (inside the transaction): excluded rows by reason.
SELECT "excludeReason", count(*) FROM "Vault" WHERE NOT "countInTotals" GROUP BY 1 ORDER BY 2 DESC;

COMMIT;

-- MarketAllocation run key: one row per vault x market x adapter per snapshot.
-- collect-market-allocations now writes with createMany({ skipDuplicates: true })
-- and dedupes in memory on the same key; this index makes the key real in the
-- DB. Additive only. The code works with or without it (ON CONFLICT DO NOTHING
-- has no target), so apply before or after the deploy.
-- Apply via Supabase MCP / SQL editor (this repo does not use prisma migrate).
-- ~179k rows / 87 MB on 2026-09-30: the build takes seconds and blocks writes
-- to MarketAllocation only while it runs (the cron writes at :15 of 04h/16h UTC).

-- ── Preview: existing duplicates on the key (expect dup_groups = 0; was 0 on 2026-09-30)
SELECT count(*) AS dup_groups, coalesce(sum(n - 1), 0) AS extra_rows
FROM (
  SELECT count(*) AS n
  FROM "MarketAllocation"
  GROUP BY "vaultId", "snapshotTime", "marketUniqueKey", "adapterAddress"
  HAVING count(*) > 1
) d;

-- ── Only if dup_groups > 0: keep one row per key (lowest id), delete the rest.
-- DELETE FROM "MarketAllocation" m
-- USING "MarketAllocation" k
-- WHERE m."vaultId" = k."vaultId"
--   AND m."snapshotTime" = k."snapshotTime"
--   AND m."marketUniqueKey" = k."marketUniqueKey"
--   AND m."adapterAddress" = k."adapterAddress"
--   AND m.id > k.id;

-- ── Change ──────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "MarketAllocation_snapshot_market_key"
  ON "MarketAllocation" ("vaultId", "snapshotTime", "marketUniqueKey", "adapterAddress");

-- ── Verification ─────────────────────────────────────────────────────────────
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'MarketAllocation' AND indexname = 'MarketAllocation_snapshot_market_key';

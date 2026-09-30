-- Upshift: blank out the placeholder share price in pre-restore snapshots.
--
-- Until the 2026-09 restore, the Upshift collector had no share price and
-- wrote sharePrice = 1 on every snapshot (2,228 rows, 2026-07-08 .. 2026-08-31).
-- The restored collector stores the real price (1.00 .. 1.11). updateReturnsMetrics
-- reads the share-price series, so the fake 1.0 history would turn into fake
-- returns as soon as a vault has 5 distinct daily prices: e.g. Upshift Wildcat
-- USD at 1.1106 would show +11% "lifetime return", bogus 30d/90d returns, and
-- the 1.0 -> real-price jump would inflate volatility / Sharpe.
--
-- updateReturnsMetrics ignores sharePrice <= 0, and only the LATEST snapshot's
-- share price is displayed, so 0 marks these rows "unknown" without other effect.
--
-- Safe + idempotent: touches only Upshift snapshots before 2026-09-01 (the last
-- placeholder was written 2026-08-31 02:46 UTC; the restored collector cannot
-- have written before that date). Apply any time around the deploy — before the
-- next alt-lane returns-metrics run is best. Apply via Supabase SQL editor.

-- Preview: expect ~2,228 rows, all with sharePrice = 1.
SELECT count(*) AS rows_to_fix, min(s."timestamp"), max(s."timestamp")
FROM "VaultSnapshot" s
JOIN "Vault" v ON v.id = s."vaultId"
WHERE v."dataSource" = 'upshift'
  AND s."sharePrice" = 1
  AND s."timestamp" < '2026-09-01';

-- Change.
UPDATE "VaultSnapshot" s
SET "sharePrice" = 0
FROM "Vault" v
WHERE v.id = s."vaultId"
  AND v."dataSource" = 'upshift'
  AND s."sharePrice" = 1
  AND s."timestamp" < '2026-09-01';

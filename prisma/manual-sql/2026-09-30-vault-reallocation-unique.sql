-- Idempotency key for VaultReallocation (PR: "perf(collect): batch Morpho
-- collector writes").
--
-- The full collect run (core-v2, full=true) re-fetches each vault's latest 50
-- reallocations every day. The old code inserted them with plain creates, so
-- every run duplicated them. The new collector skips events it already stored
-- (prefetch + createMany skipDuplicates); this index makes the same key a
-- database guarantee, so skipDuplicates also holds under a concurrent writer.
--
-- Key: one reallocation event = (vault, tx, market, type, amount). The Morpho
-- API serves no stored log index; a single tx touches each market once per
-- direction. NULLS NOT DISTINCT (Postgres 15+; prod is 17) so rows with a null
-- txHash/marketId/type still dedupe.
--
-- Not in schema.prisma (Prisma cannot express NULLS NOT DISTINCT); this repo
-- does not use prisma migrate, so nothing drops it. Safe to apply before or
-- after the PR deploys. Idempotent. Apply via Supabase SQL editor.
-- As of 2026-09-30 the table has 0 rows (V2 vaults serve no reallocations),
-- so the dedupe step below is a no-op; it stays for safety.

-- Preview (read-only): duplicate groups the DELETE would collapse.
SELECT "vaultId", "txHash", "marketId", "type", "amount", COUNT(*) AS copies
FROM "VaultReallocation"
GROUP BY "vaultId", "txHash", "marketId", "type", "amount"
HAVING COUNT(*) > 1
ORDER BY copies DESC
LIMIT 50;

BEGIN;

-- Keep the earliest-created copy of each event.
DELETE FROM "VaultReallocation" r
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "vaultId", "txHash", "marketId", "type", "amount"
           ORDER BY "createdAt", id
         ) AS rn
  FROM "VaultReallocation"
) d
WHERE r.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "VaultReallocation_event_key"
  ON "VaultReallocation" ("vaultId", "txHash", "marketId", "type", "amount")
  NULLS NOT DISTINCT;

COMMIT;

-- Verify: the index exists and no duplicates remain.
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'VaultReallocation' AND indexname = 'VaultReallocation_event_key';

-- Totals hygiene columns on Vault (PR: "Data quality: dedupe wrappers/bridged/
-- nested, phantom guard, stale exclusion, launch detector").
--
--   countInTotals  false = row stays visible on its pages but is left out of
--                  every aggregate (curator AUM, home/directory totals, digest,
--                  lenses). Default true.
--   excludeReason  why countInTotals is false: 'wrapper' | 'bridged' | 'nested'
--                  | 'cross_source_dup' | 'phantom' | 'unlisted'.
--   lastSnapshotAt stamped by every collector when it writes a VaultSnapshot.
--                  Rows older than 7 days are stale and not counted.
--
-- Additive: the new code SELECTs these columns, so apply this file BEFORE the
-- PR deploys. The old code ignores them. Idempotent (IF NOT EXISTS / guarded
-- constraint). Vault already has RLS enabled (rls-enable-and-policies.sql); no
-- new table, so no new policy is needed.
-- Apply via Supabase SQL editor (this repo does not use prisma migrate).
-- Then apply 2026-09-30-data-quality-corrections.sql.

-- Preview (read-only): the columns should not exist yet on first apply.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Vault'
  AND column_name IN ('countInTotals', 'excludeReason', 'lastSnapshotAt');

BEGIN;

ALTER TABLE "Vault" ADD COLUMN IF NOT EXISTS "countInTotals" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Vault" ADD COLUMN IF NOT EXISTS "excludeReason" TEXT;
ALTER TABLE "Vault" ADD COLUMN IF NOT EXISTS "lastSnapshotAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Vault_excludeReason_check'
  ) THEN
    ALTER TABLE "Vault" ADD CONSTRAINT "Vault_excludeReason_check" CHECK (
      "excludeReason" IS NULL OR "excludeReason" IN
        ('wrapper', 'bridged', 'nested', 'cross_source_dup', 'phantom', 'unlisted')
    );
  END IF;
END $$;

COMMIT;

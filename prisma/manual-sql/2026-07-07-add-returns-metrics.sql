-- Returns-analytics columns on Vault (P7 of the coverage roadmap).
-- Computed from VaultSnapshot share-price history by
-- src/scripts/update-returns-metrics.ts (runs in the core collect cron).
-- Additive + nullable: safe to apply before the code deploys.

ALTER TABLE "Vault" ADD COLUMN IF NOT EXISTS "ret30dPct" DOUBLE PRECISION;
ALTER TABLE "Vault" ADD COLUMN IF NOT EXISTS "ret90dPct" DOUBLE PRECISION;
ALTER TABLE "Vault" ADD COLUMN IF NOT EXISTS "retLifetimePct" DOUBLE PRECISION;
ALTER TABLE "Vault" ADD COLUMN IF NOT EXISTS "vol90dPct" DOUBLE PRECISION;
ALTER TABLE "Vault" ADD COLUMN IF NOT EXISTS "sharpe90d" DOUBLE PRECISION;
ALTER TABLE "Vault" ADD COLUMN IF NOT EXISTS "maxDrawdownPct" DOUBLE PRECISION;

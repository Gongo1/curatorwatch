-- Cron run log (fail-loud monitoring). Additive only: one new table + index.
-- Every cron route records one CronRun row per invocation through
-- src/lib/cron-run.ts (withCronRun); /api/cron/health and /api/health read it.
-- Apply to prod BEFORE the deploy build (Prisma client expects the table; until
-- it exists every cron still runs, but logs "CronRun write failed" and the
-- health check reports a "cron-log" breach).
-- Apply via Supabase MCP / SQL editor (this repo does not use prisma migrate).

-- ── Preview: the table must not exist yet (expect existing_table = NULL) ────
SELECT to_regclass('public."CronRun"') AS existing_table;

-- ── Change ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CronRun" (
  "id"          TEXT PRIMARY KEY,
  "job"         TEXT NOT NULL,
  "lane"        TEXT,
  "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"  TIMESTAMP(3),
  "status"      TEXT NOT NULL DEFAULT 'running',
  "rowsWritten" INTEGER,
  "stepErrors"  JSONB,
  "error"       TEXT
);
CREATE INDEX IF NOT EXISTS "CronRun_job_startedAt_idx" ON "CronRun"("job", "startedAt" DESC);

-- RLS to match the rest of the schema (the app's postgres role bypasses RLS;
-- no anon/authenticated policies = no public access).
ALTER TABLE "CronRun" ENABLE ROW LEVEL SECURITY;

-- ── Verification ─────────────────────────────────────────────────────────────
-- SELECT relname, relrowsecurity FROM pg_class
--   WHERE relnamespace = 'public'::regnamespace AND relname = 'CronRun';
-- (relrowsecurity should be true.)

-- ── Rollback ─────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS "CronRun";

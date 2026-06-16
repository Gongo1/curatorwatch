-- ============================================================================
-- RLS hardening for all 20 public tables.  *** STAGED — DO NOT APPLY BLINDLY ***
-- Requires Austin's review + apply. Supabase flags this as a CRITICAL advisor:
-- every table is currently exposed to the anon/authenticated roles, so anyone
-- with the anon key can read or modify every row.
-- ----------------------------------------------------------------------------
-- WHY THIS IS SAFE FOR THE APP:
--   The Next app reaches Postgres ONLY through Prisma (DATABASE_URL → Supabase
--   pooler as the `postgres` role, which has BYPASSRLS). Enabling RLS therefore
--   does NOT affect any app query — it only closes direct anon/authenticated
--   (supabase-js / PostgREST) access. The codebase audit found no supabase-js
--   usage, so the lockdown below is expected to be a pure security win.
--
-- PRE-APPLY CHECKLIST (Austin):
--   1. Confirm nothing uses the Supabase anon/service key + supabase-js to read
--      these tables from the browser (grep: "@supabase/supabase-js", "createClient").
--   2. Apply on a Supabase BRANCH first; smoke-test the app (home, curator, vault,
--      digest, /api/*). All app reads go through Prisma and must keep working.
--   3. Re-run `get_advisors(security)` — the rls_disabled critical should clear.
--   4. Then apply to production and redeploy is NOT required (no app code change).
--
-- OPTION A (RECOMMENDED) — full lockdown: enable RLS, add NO anon policies.
--   Direct anon/authenticated access is denied; the app (Prisma/postgres) is
--   unaffected. Strongest posture; matches "these are server-owned tables".
--
-- OPTION B — public read for market-data tables only (uncomment the policy block):
--   If you ever want a browser supabase-js client to READ public market data,
--   grant SELECT to anon on the non-PII tables only. NEVER grant write, and never
--   expose User / TrackedVault / TrackedCurator / DepositRecord (wallets, emails).
-- ============================================================================

-- ── OPTION A: enable RLS on all 20 tables (deny-by-default) ──────────────────
ALTER TABLE public."Vault"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VaultSnapshot"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdapterAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VaultTransaction"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VaultReallocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VaultRiskSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VaultChange"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Curator"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CuratorNews"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VaultPosition"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MarketAllocation"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Liquidation"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CuratorSnapshot"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PlatformAlert"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TrackedVault"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TrackedCurator"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DepositRecord"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CuratorRating"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."VaultRating"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Digest"            ENABLE ROW LEVEL SECURITY;

-- ── OPTION B (commented): public SELECT for non-PII market-data tables ───────
-- Uncomment to allow a future browser supabase-js client to read public data.
-- Leaves User/TrackedVault/TrackedCurator/DepositRecord locked (no policy).
--
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY[
--     'Vault','VaultSnapshot','AdapterAllocation','VaultTransaction','VaultReallocation',
--     'VaultRiskSnapshot','VaultChange','Curator','CuratorNews','MarketAllocation',
--     'Liquidation','CuratorSnapshot','PlatformAlert','CuratorRating','VaultRating','Digest'
--   ] LOOP
--     EXECUTE format(
--       'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true);',
--       'public_read_' || t, t
--     );
--   END LOOP;
-- END $$;

-- ── Verification ─────────────────────────────────────────────────────────────
-- SELECT relname, relrowsecurity FROM pg_class
--   WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' ORDER BY relname;
-- (relrowsecurity should be true for all 21 tables.)

-- ── Rollback ─────────────────────────────────────────────────────────────────
-- ALTER TABLE public."Vault" DISABLE ROW LEVEL SECURITY;  -- ...repeat per table.

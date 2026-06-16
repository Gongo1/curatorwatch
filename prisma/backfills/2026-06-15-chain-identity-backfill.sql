-- Chain-identity backfill — applied 2026-06-15 via Supabase MCP (role: postgres).
-- Pairs with commit "Chain identity: read Turtle's real chainId; stop collapsing
-- chains onto Ethereum". The code fix self-heals rows on the next cron; this backfill
-- corrected the existing rows immediately.
--
-- All 7 chainIds were verified against the live Turtle feed
-- (earn.turtle.xyz/v1/opportunities — each chain object carries an explicit numeric
-- chainId) and cross-checked against the risk engine's VaultRating data.
--
-- Effect (active vaults): chainId=1 went from 288 -> 228 (now only real Ethereum:
-- 142 morpho + 86 turtle). 60 non-Ethereum Turtle vaults moved to their real chainId
-- with TitleCase names; 143 Morpho rows had chainName NULL -> 'Ethereum'.

BEGIN;
-- Step 1: correct mis-stored chainId for the 7 previously-unmapped Turtle chains
UPDATE "Vault" SET "chainId"=143    WHERE "dataSource"='turtle' AND lower("chainName")='monad';
UPDATE "Vault" SET "chainId"=9745   WHERE "dataSource"='turtle' AND lower("chainName")='plasma';
UPDATE "Vault" SET "chainId"=747474 WHERE "dataSource"='turtle' AND lower("chainName")='katana';
UPDATE "Vault" SET "chainId"=130    WHERE "dataSource"='turtle' AND lower("chainName")='unichain';
UPDATE "Vault" SET "chainId"=80094  WHERE "dataSource"='turtle' AND lower("chainName")='berachain';
UPDATE "Vault" SET "chainId"=999    WHERE "dataSource"='turtle' AND lower("chainName")='hyperevm';
UPDATE "Vault" SET "chainId"=239    WHERE "dataSource"='turtle' AND lower("chainName")='tac';
-- Step 2: canonicalize chainName casing (keyed on lowercase name, independent of chainId)
UPDATE "Vault" SET "chainName"='Monad'     WHERE lower("chainName")='monad';
UPDATE "Vault" SET "chainName"='Plasma'    WHERE lower("chainName")='plasma';
UPDATE "Vault" SET "chainName"='Katana'    WHERE lower("chainName")='katana';
UPDATE "Vault" SET "chainName"='Unichain'  WHERE lower("chainName")='unichain';
UPDATE "Vault" SET "chainName"='Berachain' WHERE lower("chainName")='berachain';
UPDATE "Vault" SET "chainName"='HyperEVM'  WHERE lower("chainName")='hyperevm';
UPDATE "Vault" SET "chainName"='TAC'       WHERE lower("chainName")='tac';
-- Step 3: backfill Morpho rows with chainName=NULL (all chainId=1 Ethereum)
UPDATE "Vault" SET "chainName"='Ethereum' WHERE "chainName" IS NULL AND "chainId"=1;
COMMIT;

-- ── Revert (if ever needed) ───────────────────────────────────────────────────
-- BEGIN;
-- UPDATE "Vault" SET "chainId"=1 WHERE "dataSource"='turtle'
--   AND "chainName" IN ('Monad','Plasma','Katana','Unichain','Berachain','HyperEVM','TAC');
-- UPDATE "Vault" SET "chainName"=lower("chainName") WHERE "chainName"
--   IN ('Monad','Plasma','Katana','Unichain','Berachain','HyperEVM','TAC');
-- UPDATE "Vault" SET "chainName"=NULL WHERE "dataSource"='morpho' AND "chainName"='Ethereum';
-- COMMIT;

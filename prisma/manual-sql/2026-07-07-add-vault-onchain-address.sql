-- Add real on-chain address fields to Vault (P6 of the coverage roadmap).
-- Turtle-sourced rows use a synthetic `address` ("turtle-<opportunity-uuid>");
-- these columns record the actual receipt/share token so cross-source dedup
-- (Turtle vs Morpho vs future Euler ingestion) can join on chain identity.
--
-- Additive + nullable: safe to apply before the code that writes it deploys.
-- Apply via Supabase MCP / SQL editor (this repo does not use prisma migrate).

ALTER TABLE "Vault" ADD COLUMN IF NOT EXISTS "onchainAddress" TEXT;
ALTER TABLE "Vault" ADD COLUMN IF NOT EXISTS "onchainSymbol" TEXT;
CREATE INDEX IF NOT EXISTS "Vault_onchainAddress_idx" ON "Vault"("onchainAddress");

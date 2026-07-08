-- Alert delivery (email subscriptions + Telegram channel push).
-- Additive: new AlertSubscription table + tgPostedAt watermark on PlatformAlert.
-- Apply via Supabase MCP / SQL editor (this repo does not use prisma migrate).

CREATE TABLE IF NOT EXISTS "AlertSubscription" (
  "id"           TEXT PRIMARY KEY,
  "email"        TEXT NOT NULL,
  "curatorIds"   TEXT[] NOT NULL DEFAULT '{}',
  "wantsDigest"  BOOLEAN NOT NULL DEFAULT false,
  "confirmedAt"  TIMESTAMP(3),
  "confirmToken" TEXT NOT NULL,
  "unsubToken"   TEXT NOT NULL,
  "lastAlertAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "AlertSubscription_email_key" ON "AlertSubscription"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "AlertSubscription_confirmToken_key" ON "AlertSubscription"("confirmToken");
CREATE UNIQUE INDEX IF NOT EXISTS "AlertSubscription_unsubToken_key" ON "AlertSubscription"("unsubToken");
CREATE INDEX IF NOT EXISTS "AlertSubscription_confirmedAt_idx" ON "AlertSubscription"("confirmedAt");

ALTER TABLE "PlatformAlert" ADD COLUMN IF NOT EXISTS "tgPostedAt" TIMESTAMP(3);

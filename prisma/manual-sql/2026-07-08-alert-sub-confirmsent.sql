-- Track when a confirmation email was sent, so emails captured while delivery
-- was dark (RESEND_API_KEY unset) get their confirmation once it's configured.
ALTER TABLE "AlertSubscription" ADD COLUMN IF NOT EXISTS "confirmSentAt" TIMESTAMP(3);

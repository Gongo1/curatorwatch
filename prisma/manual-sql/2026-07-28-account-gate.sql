-- Account gate: AppUser (Clerk-linked identities + unique handle) and GateEvent
-- (funnel telemetry). Additive only; apply to prod BEFORE the deploy build.
CREATE TABLE IF NOT EXISTS "AppUser" (
  "id" TEXT PRIMARY KEY,
  "clerkId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_clerkId_key" ON "AppUser"("clerkId");
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_email_key" ON "AppUser"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_handle_key" ON "AppUser"("handle");

CREATE TABLE IF NOT EXISTS "GateEvent" (
  "id" TEXT PRIMARY KEY,
  "event" TEXT NOT NULL,
  "surface" TEXT,
  "trigger" TEXT,
  "step" TEXT,
  "clerkId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "GateEvent_event_createdAt_idx" ON "GateEvent"("event", "createdAt");

-- RLS to match the rest of the schema (service role bypasses; no public access).
ALTER TABLE "AppUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GateEvent" ENABLE ROW LEVEL SECURITY;

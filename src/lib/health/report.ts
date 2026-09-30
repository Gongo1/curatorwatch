/**
 * Health report = freshness (SLAs, coverage, cron run log) + quality
 * assertions. Served by /api/health, enforced by /api/cron/health (admin
 * email) and by the digest guard (refuses to publish).
 */

import { prisma } from "@/lib/db";
import { sendEmail, SITE_URL } from "@/lib/notify/email";
import {
  freshnessBreaches,
  getCronHealth,
  getSourceFreshness,
  type CronHealth,
  type HealthBreach,
  type SourceFreshness,
} from "./freshness";
import { qualityBreaches, runQualityChecks, type QualityCheck } from "./quality";

export interface HealthReport {
  checkedAt: string;
  ok: boolean;
  breaches: HealthBreach[];
  sources: SourceFreshness[];
  cron: CronHealth;
  quality: QualityCheck[];
}

export async function getHealthReport(now: Date = new Date()): Promise<HealthReport> {
  // Serial on purpose: transaction pooler, connection_limit=1.
  const sources = await getSourceFreshness(now);
  const cron = await getCronHealth(now);
  const quality = await runQualityChecks(now);
  const breaches = [...freshnessBreaches(sources, cron), ...qualityBreaches(quality)];
  return { checkedAt: now.toISOString(), ok: breaches.length === 0, breaches, sources, cron, quality };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain admin email (no unsubscribe: internal). */
export async function sendAdminEmail(
  subject: string,
  lines: string[]
): Promise<{ sent: boolean; reason?: string }> {
  const to = process.env.ALERT_ADMIN_EMAIL;
  if (!to) return { sent: false, reason: "ALERT_ADMIN_EMAIL not set" };
  const html = `<!doctype html><html><body style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:1.6;color:#1a1a19;">
<div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b6a66;margin-bottom:12px;">CuratorWatch monitoring</div>
<ul style="padding-left:18px;">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
<p><a href="${SITE_URL}/api/health">${SITE_URL}/api/health</a></p>
</body></html>`;
  return sendEmail({ to, subject, html });
}

export const ALERT_EMAIL_JOB = "alert-email";

/**
 * Email the admin about breaches not already emailed today (UTC). Dedupe is
 * per breach key per day via CronRun rows (job "alert-email", lane = key),
 * written only after a successful send, so a failed send retries next run.
 */
export async function alertAdminOnce(
  breaches: HealthBreach[],
  now: Date = new Date()
): Promise<{ emailed: string[]; alreadySent: string[]; error?: string }> {
  if (breaches.length === 0) return { emailed: [], alreadySent: [] };
  const dayStart = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const sent = await prisma.cronRun.findMany({
    where: {
      job: ALERT_EMAIL_JOB,
      startedAt: { gte: dayStart },
      lane: { in: breaches.map((b) => b.key) },
    },
    select: { lane: true },
  });
  const sentKeys = new Set(sent.map((r) => r.lane));
  const fresh = breaches.filter((b) => !sentKeys.has(b.key));
  const alreadySent = breaches.filter((b) => sentKeys.has(b.key)).map((b) => b.key);
  if (fresh.length === 0) return { emailed: [], alreadySent };

  const result = await sendAdminEmail(
    `[CuratorWatch] ${fresh.length} health breach${fresh.length === 1 ? "" : "es"}: ${fresh
      .slice(0, 3)
      .map((b) => b.key)
      .join(", ")}${fresh.length > 3 ? ", ..." : ""}`,
    fresh.map((b) => b.message)
  );
  if (!result.sent) return { emailed: [], alreadySent, error: result.reason };

  await prisma.cronRun.createMany({
    data: fresh.map((b) => ({
      job: ALERT_EMAIL_JOB,
      lane: b.key,
      startedAt: now,
      finishedAt: now,
      status: "ok",
      rowsWritten: 1,
    })),
  });
  return { emailed: fresh.map((b) => b.key), alreadySent };
}

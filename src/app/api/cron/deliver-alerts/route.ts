import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail, alertsEmail, digestEmail, emailConfigured, SITE_URL } from "@/lib/notify/email";
import { sendTelegram, formatAlertTg, formatDigestTg, telegramConfigured } from "@/lib/notify/telegram";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const TG_SEVERITIES = ["warning", "critical"]; // channel gets signal, not info-noise
const MAX_TG_PER_RUN = 10; // never flood the channel in one run
const MAX_ALERTS_PER_EMAIL = 20;

/**
 * Delivery cron.
 *  - default: batch-email new alerts (per subscriber's curators) since each
 *    subscriber's watermark; push warning/critical alerts to the TG channel.
 *  - ?digest=true: email the latest daily digest to digest subscribers and
 *    post its headline to the TG channel (scheduled after the 05:00 digest).
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const urlSecret = request.nextUrl.searchParams.get("secret");

  if (cronSecret) {
    const isValidAuth = authHeader === `Bearer ${cronSecret}`;
    const isValidQuery = urlSecret === cronSecret;

    if (!isValidAuth && !isValidQuery) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const digestMode = request.nextUrl.searchParams.get("digest") === "true";
  const summary: Record<string, unknown> = {
    emailConfigured: emailConfigured(),
    telegramConfigured: telegramConfigured(),
  };

  try {
    if (digestMode) {
      // ── Daily digest delivery ────────────────────────────────────────────
      const digest = await prisma.digest.findFirst({
        where: { published: true },
        orderBy: { date: "desc" },
      });
      if (!digest) return NextResponse.json({ success: true, summary: { ...summary, digest: "none" } });

      let emailed = 0;
      let failed = 0;
      if (emailConfigured()) {
        const subs = await prisma.alertSubscription.findMany({
          where: { wantsDigest: true, confirmedAt: { not: null } },
        });
        for (const sub of subs) {
          const unsubUrl = `${SITE_URL}/api/alerts/unsubscribe?token=${sub.unsubToken}`;
          const mail = digestEmail(digest, unsubUrl);
          const result = await sendEmail({ to: sub.email, subject: mail.subject, html: mail.html });
          if (result.sent) emailed++;
          else {
            failed++;
            console.error(`[deliver] digest → ${sub.email} failed:`, result.reason);
          }
        }
      }

      let tg: { sent: boolean; reason?: string } = { sent: false, reason: "skipped" };
      if (telegramConfigured()) {
        tg = await sendTelegram(formatDigestTg(digest, SITE_URL));
      }

      summary.digest = { slug: digest.slug, emailed, failed, telegram: tg };
      return NextResponse.json({ success: true, summary });
    }

    // ── Alert delivery ───────────────────────────────────────────────────────
    // Telegram channel: warning/critical alerts not yet posted (48h lookback
    // cap keeps a first-enable from replaying history).
    let tgPosted = 0;
    if (telegramConfigured()) {
      const toPost = await prisma.platformAlert.findMany({
        where: {
          tgPostedAt: null,
          severity: { in: TG_SEVERITIES },
          detectedAt: { gt: new Date(Date.now() - 48 * 3600_000) },
        },
        orderBy: { detectedAt: "asc" },
        take: MAX_TG_PER_RUN,
        include: { curator: { select: { name: true } } },
      });
      for (const a of toPost) {
        const result = await sendTelegram(
          formatAlertTg(
            { severity: a.severity, title: a.title, description: a.description, curatorName: a.curator?.name ?? null },
            SITE_URL
          )
        );
        if (result.sent) {
          await prisma.platformAlert.update({ where: { id: a.id }, data: { tgPostedAt: new Date() } });
          tgPosted++;
        } else {
          console.error("[deliver] telegram failed:", result.reason);
          break; // token/channel problem — don't hammer the API
        }
      }
    }
    summary.telegramPosted = tgPosted;

    // Email: per confirmed subscriber, alerts on their curators since their watermark.
    let emailed = 0;
    let failed = 0;
    let skippedNoNews = 0;
    if (emailConfigured()) {
      const subs = await prisma.alertSubscription.findMany({
        where: { confirmedAt: { not: null } },
      });
      for (const sub of subs) {
        if (sub.curatorIds.length === 0) continue; // digest-only subscriber
        const alerts = await prisma.platformAlert.findMany({
          where: {
            curatorId: { in: sub.curatorIds },
            detectedAt: { gt: sub.lastAlertAt },
            severity: { in: ["warning", "critical"] },
          },
          orderBy: { detectedAt: "desc" },
          take: MAX_ALERTS_PER_EMAIL,
          include: { curator: { select: { name: true } } },
        });
        if (alerts.length === 0) {
          skippedNoNews++;
          continue;
        }
        const unsubUrl = `${SITE_URL}/api/alerts/unsubscribe?token=${sub.unsubToken}`;
        const mail = alertsEmail(
          alerts.map((a) => ({
            severity: a.severity,
            title: a.title,
            description: a.description,
            curatorName: a.curator?.name ?? null,
            detectedAt: a.detectedAt,
          })),
          unsubUrl
        );
        const result = await sendEmail({ to: sub.email, subject: mail.subject, html: mail.html });
        if (result.sent) {
          emailed++;
          await prisma.alertSubscription.update({
            where: { id: sub.id },
            data: { lastAlertAt: new Date() },
          });
        } else {
          failed++;
          console.error(`[deliver] alerts → ${sub.email} failed:`, result.reason);
        }
      }
    }
    summary.alertEmails = { emailed, failed, skippedNoNews };

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("[CRON] Alert delivery failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "delivery failed", summary },
      { status: 500 }
    );
  }
}

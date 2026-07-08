import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail, confirmEmail, emailConfigured, SITE_URL } from "@/lib/notify/email";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_CURATORS = 20;

/**
 * POST { email, curatorIds?: string[], wantsDigest?: boolean }
 *
 * ALWAYS persists the subscription (we capture every interested email), then:
 *  - if email delivery is configured and the sub isn't confirmed yet → sends
 *    the double-opt-in confirmation and stamps confirmSentAt.
 *  - if delivery isn't configured yet → saves the record with confirmSentAt
 *    null; the deliver-alerts cron sends confirmations to this backlog once the
 *    keys land. The user is told they're on the list.
 * Re-subscribing an existing email updates its preferences.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; curatorIds?: string[]; wantsDigest?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const wantsDigest = Boolean(body.wantsDigest);
  const curatorIds = Array.isArray(body.curatorIds) ? body.curatorIds.slice(0, MAX_CURATORS) : [];

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ success: false, error: "Enter a valid email address" }, { status: 400 });
  }
  if (curatorIds.length === 0 && !wantsDigest) {
    return NextResponse.json(
      { success: false, error: "Pick at least one curator or the daily digest" },
      { status: 400 }
    );
  }

  // Validate curator ids against real curators (and get names for the email)
  const curators = curatorIds.length
    ? await prisma.curator.findMany({
        where: { id: { in: curatorIds } },
        select: { id: true, name: true },
      })
    : [];
  const validIds = curators.map((c) => c.id);

  const confirmToken = randomBytes(24).toString("base64url");
  const unsubToken = randomBytes(24).toString("base64url");

  const existing = await prisma.alertSubscription.findUnique({ where: { email } });
  const sub = existing
    ? await prisma.alertSubscription.update({
        where: { email },
        data: { curatorIds: validIds, wantsDigest },
      })
    : await prisma.alertSubscription.create({
        data: { email, curatorIds: validIds, wantsDigest, confirmToken, unsubToken },
      });

  if (sub.confirmedAt) {
    return NextResponse.json({ success: true, status: "updated" });
  }

  // Not yet confirmed. If we can send email, send the confirmation now.
  // Otherwise the record is saved (email captured) and the delivery cron will
  // send confirmations to the backlog once delivery is configured.
  if (!emailConfigured()) {
    return NextResponse.json({ success: true, status: "saved_pending" });
  }

  const confirmUrl = `${SITE_URL}/api/alerts/confirm?token=${sub.confirmToken}`;
  const mail = confirmEmail(
    confirmUrl,
    curators.map((c) => c.name ?? "unnamed curator"),
    wantsDigest
  );
  const result = await sendEmail({ to: email, subject: mail.subject, html: mail.html });
  if (!result.sent) {
    console.error("[alerts] confirmation email failed:", result.reason);
    // The record is still saved — treat a send failure as "captured, pending"
    // rather than losing the interested email.
    return NextResponse.json({ success: true, status: "saved_pending" });
  }
  await prisma.alertSubscription.update({
    where: { id: sub.id },
    data: { confirmSentAt: new Date() },
  });
  return NextResponse.json({ success: true, status: "confirmation_sent" });
}

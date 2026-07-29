import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { GATE_ENABLED } from "@/lib/gate/config";

export const dynamic = "force-dynamic";

// Account-holder digest opt-in. The account email is already verified by the
// Clerk sign-up code, so — unlike the anonymous /api/alerts/subscribe flow —
// there is no double-opt-in email round-trip: subscriptions are created
// pre-confirmed, and this works even before email *delivery* is configured.

async function accountEmail(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
}

/** GET → { wantsDigest } for the signed-in account's email. */
export async function GET() {
  if (!GATE_ENABLED) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const email = await accountEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const sub = await prisma.alertSubscription.findUnique({
    where: { email },
    select: { wantsDigest: true, curatorIds: true },
  });
  return NextResponse.json({
    wantsDigest: sub?.wantsDigest ?? false,
    curatorCount: sub?.curatorIds.length ?? 0,
  });
}

/** POST { wantsDigest: boolean } → toggles the daily digest for the account. */
export async function POST(request: NextRequest) {
  if (!GATE_ENABLED) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const email = await accountEmail();
  if (!email) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const wantsDigest = Boolean(body?.wantsDigest);

  const existing = await prisma.alertSubscription.findUnique({ where: { email } });
  if (existing) {
    await prisma.alertSubscription.update({
      where: { email },
      // Clerk verified this email at sign-up — confirm in place if the row
      // predates the account (e.g. an unconfirmed anonymous subscription).
      data: { wantsDigest, confirmedAt: existing.confirmedAt ?? new Date() },
    });
  } else {
    await prisma.alertSubscription.create({
      data: {
        email,
        wantsDigest,
        curatorIds: [],
        confirmedAt: new Date(),
        confirmToken: randomBytes(24).toString("base64url"),
        unsubToken: randomBytes(24).toString("base64url"),
      },
    });
  }
  return NextResponse.json({ success: true, wantsDigest });
}

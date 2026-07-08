import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/notify/email";

export const dynamic = "force-dynamic";

/** GET ?token=… — double-opt-in confirmation link from the email. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!token) return NextResponse.redirect(`${SITE_URL}/alerts?subscribe=invalid`);

  const sub = await prisma.alertSubscription.findUnique({ where: { confirmToken: token } });
  if (!sub) return NextResponse.redirect(`${SITE_URL}/alerts?subscribe=invalid`);

  if (!sub.confirmedAt) {
    await prisma.alertSubscription.update({
      where: { id: sub.id },
      // Watermark starts at confirmation: no back-delivery of old alerts
      data: { confirmedAt: new Date(), lastAlertAt: new Date() },
    });
  }
  return NextResponse.redirect(`${SITE_URL}/alerts?subscribe=confirmed`);
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/notify/email";

export const dynamic = "force-dynamic";

/** GET ?token=… — one-click unsubscribe from any email footer. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!token) return NextResponse.redirect(`${SITE_URL}/alerts?subscribe=invalid`);

  const sub = await prisma.alertSubscription.findUnique({ where: { unsubToken: token } });
  if (sub) {
    await prisma.alertSubscription.delete({ where: { id: sub.id } });
  }
  // Idempotent: an already-deleted token still lands on the confirmation page
  return NextResponse.redirect(`${SITE_URL}/alerts?subscribe=unsubscribed`);
}

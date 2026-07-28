import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { GATE_ENABLED } from "@/lib/gate/config";

const EVENTS = new Set([
  "gate_impression",
  "gate_click",
  "modal_open",
  "modal_abandon",
  "signup_complete",
  "unlock_engagement",
  "alert_optin_post_signup",
]);

const clip = (v: unknown): string | null =>
  typeof v === "string" ? v.slice(0, 64) : null;

export async function POST(request: NextRequest) {
  if (!GATE_ENABLED) return NextResponse.json({ ok: true });
  try {
    const body = await request.json();
    if (!EVENTS.has(body?.event)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const { userId } = await auth();
    await prisma.gateEvent.create({
      data: {
        event: body.event,
        surface: clip(body.surface),
        trigger: clip(body.trigger),
        step: clip(body.step),
        clerkId: userId ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Telemetry endpoint: never surface errors to the client.
    return NextResponse.json({ ok: true });
  }
}

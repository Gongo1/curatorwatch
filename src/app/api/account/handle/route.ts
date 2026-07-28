import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { GATE_ENABLED, HANDLE_RE } from "@/lib/gate/config";

// GET  ?check=<handle>  → { available }  (format + uniqueness)
// GET                   → { handle }     (current user's handle, null if unset)
// POST { handle }       → claims the handle for the signed-in user (upsert)

export async function GET(request: NextRequest) {
  if (!GATE_ENABLED) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const check = request.nextUrl.searchParams.get("check");
  if (check !== null) {
    const handle = check.toLowerCase();
    if (!HANDLE_RE.test(handle)) {
      return NextResponse.json({ available: false, reason: "format" });
    }
    const taken = await prisma.appUser.findUnique({ where: { handle }, select: { id: true } });
    return NextResponse.json({ available: !taken });
  }
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ handle: null });
  const user = await prisma.appUser.findUnique({
    where: { clerkId: userId },
    select: { handle: true },
  });
  return NextResponse.json({ handle: user?.handle ?? null });
}

export async function POST(request: NextRequest) {
  if (!GATE_ENABLED) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const handle = String(body?.handle ?? "").toLowerCase();
  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json({ error: "3–20 chars: a–z, 0–9, hyphens" }, { status: 422 });
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const email = clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) return NextResponse.json({ error: "no email on account" }, { status: 422 });

  try {
    const user = await prisma.appUser.upsert({
      where: { clerkId: userId },
      create: { clerkId: userId, email, handle },
      update: { handle },
    });
    return NextResponse.json({ handle: user.handle });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "That handle is taken" }, { status: 409 });
    }
    throw e;
  }
}

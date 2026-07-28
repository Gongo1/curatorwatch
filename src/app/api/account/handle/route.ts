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

  const isUnique = (e: unknown): e is Prisma.PrismaClientKnownRequestError =>
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
  const uniqueTarget = (e: Prisma.PrismaClientKnownRequestError): string =>
    Array.isArray(e.meta?.target) ? (e.meta.target as string[]).join(",") : String(e.meta?.target ?? "");

  try {
    const user = await prisma.appUser.upsert({
      where: { clerkId: userId },
      create: { clerkId: userId, email, handle },
      update: { handle },
    });
    return NextResponse.json({ handle: user.handle });
  } catch (e) {
    if (!isUnique(e)) throw e;
    // Distinguish WHICH constraint fired — reporting every P2002 as a handle
    // collision produced false "taken" errors.
    if (uniqueTarget(e).includes("email")) {
      // Same verified email under a new Clerk identity (retries after failed
      // sign-ups, dev-instance user resets). The session proves ownership of
      // the email, so re-link the existing row to the current Clerk user.
      try {
        const user = await prisma.appUser.update({
          where: { email },
          data: { clerkId: userId, handle },
        });
        return NextResponse.json({ handle: user.handle });
      } catch (e2) {
        if (isUnique(e2)) {
          return NextResponse.json({ error: "That handle is taken" }, { status: 409 });
        }
        throw e2;
      }
    }
    return NextResponse.json({ error: "That handle is taken" }, { status: 409 });
  }
}

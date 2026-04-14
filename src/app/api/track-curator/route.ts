import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tracked = await prisma.trackedCurator.findMany({
    where: { userId },
    select: { curatorAddress: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ addresses: tracked.map((t) => t.curatorAddress) });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { curatorAddress } = await req.json();
  if (!curatorAddress || typeof curatorAddress !== "string") {
    return NextResponse.json({ error: "curatorAddress required" }, { status: 400 });
  }

  await prisma.trackedCurator.upsert({
    where: { userId_curatorAddress: { userId, curatorAddress } },
    create: { userId, curatorAddress },
    update: {},
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { curatorAddress } = await req.json();
  if (!curatorAddress || typeof curatorAddress !== "string") {
    return NextResponse.json({ error: "curatorAddress required" }, { status: 400 });
  }

  await prisma.trackedCurator.deleteMany({
    where: { userId, curatorAddress },
  });

  return NextResponse.json({ success: true });
}

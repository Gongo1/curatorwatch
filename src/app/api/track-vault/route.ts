import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tracked = await prisma.trackedVault.findMany({
    where: { userId },
    select: { vaultAddress: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ addresses: tracked.map((t) => t.vaultAddress) });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultAddress } = await req.json();
  if (!vaultAddress || typeof vaultAddress !== "string") {
    return NextResponse.json({ error: "vaultAddress required" }, { status: 400 });
  }

  await prisma.trackedVault.upsert({
    where: { userId_vaultAddress: { userId, vaultAddress } },
    create: { userId, vaultAddress },
    update: {},
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vaultAddress } = await req.json();
  if (!vaultAddress || typeof vaultAddress !== "string") {
    return NextResponse.json({ error: "vaultAddress required" }, { status: 400 });
  }

  await prisma.trackedVault.deleteMany({
    where: { userId, vaultAddress },
  });

  return NextResponse.json({ success: true });
}

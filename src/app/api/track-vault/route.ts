import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ addresses: [] });
}

export async function POST(req: NextRequest) {
  const { vaultAddress } = await req.json();
  if (!vaultAddress || typeof vaultAddress !== "string") {
    return NextResponse.json({ error: "vaultAddress required" }, { status: 400 });
  }

  // Tracking disabled without auth
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { vaultAddress } = await req.json();
  if (!vaultAddress || typeof vaultAddress !== "string") {
    return NextResponse.json({ error: "vaultAddress required" }, { status: 400 });
  }

  // Tracking disabled without auth
  return NextResponse.json({ success: true });
}

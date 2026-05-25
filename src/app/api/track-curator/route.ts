import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ addresses: [] });
}

export async function POST(req: NextRequest) {
  const { curatorAddress } = await req.json();
  if (!curatorAddress || typeof curatorAddress !== "string") {
    return NextResponse.json({ error: "curatorAddress required" }, { status: 400 });
  }

  // Tracking disabled without auth
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { curatorAddress } = await req.json();
  if (!curatorAddress || typeof curatorAddress !== "string") {
    return NextResponse.json({ error: "curatorAddress required" }, { status: 400 });
  }

  // Tracking disabled without auth
  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkUserEvent {
  data: {
    id: string;
    email_addresses: ClerkEmailAddress[];
    primary_email_address_id: string;
  };
  type: string;
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();

  let event: ClerkUserEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const { id, email_addresses, primary_email_address_id } = event.data;
    const primaryEmail = email_addresses.find(
      (e) => e.id === primary_email_address_id
    )?.email_address ?? email_addresses[0]?.email_address ?? "";

    await prisma.user.upsert({
      where: { clerkId: id },
      create: { clerkId: id, email: primaryEmail },
      update: { email: primaryEmail },
    });
  }

  if (event.type === "user.deleted") {
    const { id } = event.data;
    await prisma.user.deleteMany({ where: { clerkId: id } });
  }

  return NextResponse.json({ success: true });
}

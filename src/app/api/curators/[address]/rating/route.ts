import { NextResponse } from "next/server";
import { calculateCuratorRiskProfile } from "@/lib/curator-risk-profile";
import { resolveCuratorSlug } from "@/lib/curator-aliases";

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { address } = await params;
    const resolvedAddress = await resolveCuratorSlug(address);

    const profile = await calculateCuratorRiskProfile(resolvedAddress);

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error("Error calculating curator risk profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate risk profile" },
      { status: 500 }
    );
  }
}

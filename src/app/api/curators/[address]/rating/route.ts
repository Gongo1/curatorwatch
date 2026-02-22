import { NextResponse } from "next/server";
import { calculateCuratorRating } from "@/lib/curator-rating";
import { resolveCuratorAddress } from "@/lib/curator-aliases";

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { address } = await params;
    const resolvedAddress = resolveCuratorAddress(address);

    const rating = await calculateCuratorRating(resolvedAddress);

    return NextResponse.json({
      success: true,
      data: rating,
    });
  } catch (error) {
    console.error("Error calculating curator rating:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate rating" },
      { status: 500 }
    );
  }
}

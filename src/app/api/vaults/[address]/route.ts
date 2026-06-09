import { NextResponse } from "next/server";
import { fetchVaultDetail } from "@/lib/vault-detail";

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { address } = await params;
    const data = await fetchVaultDetail(address);

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Vault not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, data },
      {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
      }
    );
  } catch (error) {
    console.error("Error fetching vault:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch vault" },
      { status: 500 }
    );
  }
}

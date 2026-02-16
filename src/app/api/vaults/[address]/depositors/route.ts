import { NextRequest, NextResponse } from "next/server";
import { morphoClient } from "@/lib/graphql/client";
import {
  GET_VAULT_POSITIONS,
  VaultPositionsResponse,
  VaultPosition,
} from "@/lib/graphql/queries";

export interface Depositor {
  address: string;
  assets: string;
  assetsUsd: number;
  shares: string;
  depositPct: number;
}

export interface DepositorsResponse {
  success: boolean;
  data: {
    depositors: Depositor[];
    totalDepositors: number;
    totalAssetsUsd: number;
  };
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<DepositorsResponse>> {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // Fetch positions from Morpho API
    const response = await morphoClient.request<VaultPositionsResponse>(
      GET_VAULT_POSITIONS,
      {
        address: address.toLowerCase(),
        chainId: 1,
        first: limit,
      }
    );

    if (!response.vaultV2ByAddress) {
      return NextResponse.json(
        {
          success: false,
          data: {
            depositors: [],
            totalDepositors: 0,
            totalAssetsUsd: 0,
          },
          error: "Vault not found",
        },
        { status: 404 }
      );
    }

    const vault = response.vaultV2ByAddress;
    const totalAssetsUsd = vault.totalAssetsUsd || 0;

    // Sort positions by assets descending (API doesn't support orderBy)
    const sortedPositions = [...vault.positions.items].sort((a, b) => {
      return b.assetsUsd - a.assetsUsd;
    });

    const depositors: Depositor[] = sortedPositions.map((pos: VaultPosition) => ({
      address: pos.user.address,
      assets: pos.assets,
      assetsUsd: pos.assetsUsd,
      shares: pos.shares,
      depositPct:
        totalAssetsUsd > 0 ? (pos.assetsUsd / totalAssetsUsd) * 100 : 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        depositors,
        totalDepositors: depositors.length,
        totalAssetsUsd,
      },
    });
  } catch (error) {
    console.error("Error fetching depositors:", error);
    return NextResponse.json(
      {
        success: false,
        data: {
          depositors: [],
          totalDepositors: 0,
          totalAssetsUsd: 0,
        },
        error: "Failed to fetch depositors",
      },
      { status: 500 }
    );
  }
}

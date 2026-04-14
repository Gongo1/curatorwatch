import { NextRequest, NextResponse } from "next/server";
import { morphoClient } from "@/lib/graphql/client";
import { GET_VAULT_POSITIONS, VaultPositionsResponse, VaultPosition } from "@/lib/graphql/queries";
import { prisma } from "@/lib/db";
import { resolveCuratorSlug } from "@/lib/curator-aliases";

interface CuratorDepositor {
  address: string;
  totalAssetsUsd: number;
  vaults: {
    address: string;
    name: string;
    assetsUsd: number;
    depositPct: number;
  }[];
  vaultCount: number;
}

interface CuratorDepositorsResponse {
  success: boolean;
  data: {
    depositors: CuratorDepositor[];
    totalDepositors: number;
    totalAUM: number;
  };
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<CuratorDepositorsResponse>> {
  try {
    const { address } = await params;
    const resolvedAddress = await resolveCuratorSlug(address);
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    // Find the curator by resolved primary address, then get all their vaults via FK
    const curator = await prisma.curator.findUnique({
      where: { address: resolvedAddress },
      select: { id: true },
    });

    const vaults = await prisma.vault.findMany({
      where: {
        curatorId: curator?.id ?? "__none__",
      },
      select: {
        address: true,
        name: true,
      },
    });

    if (vaults.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          depositors: [],
          totalDepositors: 0,
          totalAUM: 0,
        },
      });
    }

    // Fetch positions for each vault
    const depositorMap = new Map<
      string,
      {
        address: string;
        totalAssetsUsd: number;
        vaults: {
          address: string;
          name: string;
          assetsUsd: number;
          depositPct: number;
        }[];
      }
    >();

    let totalAUM = 0;

    for (const vault of vaults) {
      try {
        const response = await morphoClient.request<VaultPositionsResponse>(
          GET_VAULT_POSITIONS,
          {
            address: vault.address.toLowerCase(),
            chainId: 1,
            first: 50,
          }
        );

        if (!response.vaultV2ByAddress) continue;

        const vaultData = response.vaultV2ByAddress;
        totalAUM += vaultData.totalAssetsUsd || 0;

        for (const pos of vaultData.positions.items) {
          const userAddr = pos.user.address.toLowerCase();
          const depositPct =
            vaultData.totalAssetsUsd > 0
              ? (pos.assetsUsd / vaultData.totalAssetsUsd) * 100
              : 0;

          const existing = depositorMap.get(userAddr);
          if (existing) {
            existing.totalAssetsUsd += pos.assetsUsd;
            existing.vaults.push({
              address: vault.address,
              name: vault.name,
              assetsUsd: pos.assetsUsd,
              depositPct,
            });
          } else {
            depositorMap.set(userAddr, {
              address: pos.user.address,
              totalAssetsUsd: pos.assetsUsd,
              vaults: [
                {
                  address: vault.address,
                  name: vault.name,
                  assetsUsd: pos.assetsUsd,
                  depositPct,
                },
              ],
            });
          }
        }
      } catch (err) {
        console.error(`Error fetching positions for vault ${vault.address}:`, err);
      }
    }

    // Convert to array, sort by total, and limit
    const depositors: CuratorDepositor[] = Array.from(depositorMap.values())
      .map((d) => ({
        ...d,
        vaultCount: d.vaults.length,
      }))
      .sort((a, b) => b.totalAssetsUsd - a.totalAssetsUsd)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        depositors,
        totalDepositors: depositorMap.size,
        totalAUM,
      },
    }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("Error fetching curator depositors:", error);
    return NextResponse.json(
      {
        success: false,
        data: {
          depositors: [],
          totalDepositors: 0,
          totalAUM: 0,
        },
        error: "Failed to fetch curator depositors",
      },
      { status: 500 }
    );
  }
}

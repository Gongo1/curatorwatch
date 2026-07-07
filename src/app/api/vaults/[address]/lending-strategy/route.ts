import { NextRequest, NextResponse } from "next/server";
import { morphoClient } from "@/lib/graphql/client";
import { getVaultChainId } from "@/lib/db";
import {
  GET_VAULT_ADAPTERS,
  VaultAdaptersResponse,
  VaultAdapterSimple,
} from "@/lib/graphql/queries";

export interface LendingMarket {
  adapterAddress: string;
  adapterType: string;
  allocationUsd: number;
  allocationPct: number;
  // Note: Market details (collateral, LLTV, etc.) require additional lookups
  note: string;
}

export interface LendingStrategyResponse {
  success: boolean;
  data: {
    markets: LendingMarket[];
    totalAllocatedUsd: number;
    idleUsd: number;
    idlePct: number;
    note: string;
  };
  error?: string;
}

// Format adapter type for display
function formatAdapterType(type: string): string {
  if (!type) return "Unknown";

  const typeMap: Record<string, string> = {
    "metamorpho": "MetaMorpho",
    "morpho": "Morpho Market",
    "idle": "Idle",
    "aave": "Aave",
    "compound": "Compound",
  };

  const lower = type.toLowerCase();
  return typeMap[lower] || type.charAt(0).toUpperCase() + type.slice(1);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<LendingStrategyResponse>> {
  try {
    const { address } = await params;

    // Fetch vault adapters from Morpho API (on the vault's own chain)
    const chainId = await getVaultChainId(address);
    const response = await morphoClient.request<VaultAdaptersResponse>(
      GET_VAULT_ADAPTERS,
      {
        address: address.toLowerCase(),
        chainId,
      }
    );

    if (!response.vaultV2ByAddress) {
      return NextResponse.json(
        {
          success: false,
          data: {
            markets: [],
            totalAllocatedUsd: 0,
            idleUsd: 0,
            idlePct: 0,
            note: "",
          },
          error: "Vault not found",
        },
        { status: 404 }
      );
    }

    const vault = response.vaultV2ByAddress;
    const totalVaultUsd = vault.totalAssetsUsd || 0;

    // Build market list from adapters
    let totalAllocatedUsd = 0;

    const markets: LendingMarket[] = vault.adapters.items
      .map((adapter: VaultAdapterSimple) => {
        totalAllocatedUsd += adapter.assetsUsd || 0;

        return {
          adapterAddress: adapter.address,
          adapterType: formatAdapterType(adapter.type),
          allocationUsd: adapter.assetsUsd || 0,
          allocationPct: totalVaultUsd > 0
            ? ((adapter.assetsUsd || 0) / totalVaultUsd) * 100
            : 0,
          note: "Detailed market info requires additional lookups",
        };
      })
      .filter((m: LendingMarket) => m.allocationUsd > 0)
      .sort((a: LendingMarket, b: LendingMarket) => b.allocationUsd - a.allocationUsd);

    // Calculate idle assets
    const idleUsd = Math.max(0, totalVaultUsd - totalAllocatedUsd);
    const idlePct = totalVaultUsd > 0 ? (idleUsd / totalVaultUsd) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        markets,
        totalAllocatedUsd,
        idleUsd,
        idlePct,
        note: "Showing adapter-level allocations. Detailed market data (collateral types, LLTV, APY) requires additional API lookups.",
      },
    });
  } catch (error) {
    console.error("Error fetching lending strategy:", error);
    return NextResponse.json(
      {
        success: false,
        data: {
          markets: [],
          totalAllocatedUsd: 0,
          idleUsd: 0,
          idlePct: 0,
          note: "",
        },
        error: "Failed to fetch lending strategy",
      },
      { status: 500 }
    );
  }
}

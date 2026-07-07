import { NextRequest, NextResponse } from "next/server";
import { morphoClient } from "@/lib/graphql/client";
import { getVaultChainId } from "@/lib/db";
import {
  GET_VAULT_ADAPTERS,
  VaultAdaptersResponse,
  VaultAdapterSimple,
} from "@/lib/graphql/queries";

// For now, we show adapter allocations since the API doesn't expose
// market/collateral details directly through the vault query
export interface AdapterAllocationItem {
  type: string;
  address: string;
  assetsUsd: number;
  allocationPct: number;
  // Collateral info would require additional market lookups
  collateralNote: string;
}

export interface CollateralExposureResponse {
  success: boolean;
  data: {
    allocations: AdapterAllocationItem[];
    totalAllocatedUsd: number;
    idleUsd: number;
    idlePct: number;
    // Note about data limitations
    note: string;
  };
  error?: string;
}

// Format adapter type for display
function formatAdapterType(type: string): string {
  if (!type) return "Unknown";

  // Common adapter type mappings
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
): Promise<NextResponse<CollateralExposureResponse>> {
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
            allocations: [],
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

    // Calculate total allocated across adapters
    let totalAllocatedUsd = 0;

    const allocations: AdapterAllocationItem[] = vault.adapters.items
      .map((adapter: VaultAdapterSimple) => {
        totalAllocatedUsd += adapter.assetsUsd || 0;

        return {
          type: formatAdapterType(adapter.type),
          address: adapter.address,
          assetsUsd: adapter.assetsUsd || 0,
          allocationPct: totalVaultUsd > 0
            ? ((adapter.assetsUsd || 0) / totalVaultUsd) * 100
            : 0,
          collateralNote: "Multiple markets",
        };
      })
      .filter((a: AdapterAllocationItem) => a.assetsUsd > 0)
      .sort((a: AdapterAllocationItem, b: AdapterAllocationItem) => b.assetsUsd - a.assetsUsd);

    // Calculate idle assets
    const idleUsd = Math.max(0, totalVaultUsd - totalAllocatedUsd);
    const idlePct = totalVaultUsd > 0 ? (idleUsd / totalVaultUsd) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        allocations,
        totalAllocatedUsd,
        idleUsd,
        idlePct,
        note: "Detailed collateral breakdown requires additional market data lookups. Showing adapter-level allocations for now.",
      },
    });
  } catch (error) {
    console.error("Error fetching adapter allocations:", error);
    return NextResponse.json(
      {
        success: false,
        data: {
          allocations: [],
          totalAllocatedUsd: 0,
          idleUsd: 0,
          idlePct: 0,
          note: "",
        },
        error: "Failed to fetch allocation data",
      },
      { status: 500 }
    );
  }
}

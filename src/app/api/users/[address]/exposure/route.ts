import { NextRequest, NextResponse } from "next/server";
import { morphoClient } from "@/lib/graphql/client";
import {
  GET_USER_POSITIONS_ACROSS_VAULTS,
  UserPositionsAcrossVaultsResponse,
  UserVaultPosition,
} from "@/lib/graphql/queries";
import { prisma } from "@/lib/db";

export interface VaultExposure {
  vaultAddress: string;
  vaultName: string;
  vaultSymbol: string;
  assetSymbol: string;
  curatorAddress: string | null;
  curatorName: string | null;
  assetsUsd: number;
  depositPct: number; // % of vault total
  vaultTvl: number;
}

export interface CuratorConcentration {
  curatorAddress: string;
  curatorName: string | null;
  totalExposure: number;
  vaultCount: number;
  exposurePct: number;
}

export interface AssetConcentration {
  assetSymbol: string;
  totalExposure: number;
  vaultCount: number;
  exposurePct: number;
}

export interface UserExposureResponse {
  success: boolean;
  data: {
    userAddress: string;
    vaults: VaultExposure[];
    totalExposure: number;
    vaultCount: number;
    curatorConcentration: CuratorConcentration[];
    assetConcentration: AssetConcentration[];
    concentrationRisk: "low" | "medium" | "high";
  };
  error?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<UserExposureResponse>> {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const curatorFilter = searchParams.get("curatorAddress");

    // Fetch user positions from Morpho API
    const response =
      await morphoClient.request<UserPositionsAcrossVaultsResponse>(
        GET_USER_POSITIONS_ACROSS_VAULTS,
        {
          userAddress: address.toLowerCase(),
          chainId: 1,
        }
      );

    const positions: UserVaultPosition[] = response.vaultV2Positions?.items || [];

    // Get curator names from database
    const curatorAddresses: string[] = [
      ...new Set(
        positions
          .filter((p: UserVaultPosition) => p.vault.curator?.address)
          .map((p: UserVaultPosition) => p.vault.curator!.address.toLowerCase())
      ),
    ];

    const curators = await prisma.curator.findMany({
      where: {
        address: {
          in: curatorAddresses,
        },
      },
      select: {
        address: true,
        name: true,
      },
    });

    const curatorNameMap = new Map(
      curators.map((c) => [c.address.toLowerCase(), c.name])
    );

    // Build vault exposures
    let vaults: VaultExposure[] = positions.map((pos: UserVaultPosition) => {
      const curatorAddr = pos.vault.curator?.address || null;
      return {
        vaultAddress: pos.vault.address,
        vaultName: pos.vault.name,
        vaultSymbol: pos.vault.symbol,
        assetSymbol: pos.vault.asset.symbol,
        curatorAddress: curatorAddr,
        curatorName: curatorAddr
          ? curatorNameMap.get(curatorAddr.toLowerCase()) || null
          : null,
        assetsUsd: pos.assetsUsd,
        depositPct:
          pos.vault.totalAssetsUsd > 0
            ? (pos.assetsUsd / pos.vault.totalAssetsUsd) * 100
            : 0,
        vaultTvl: pos.vault.totalAssetsUsd,
      };
    });

    // Apply curator filter if specified
    if (curatorFilter) {
      vaults = vaults.filter(
        (v) =>
          v.curatorAddress?.toLowerCase() === curatorFilter.toLowerCase()
      );
    }

    // Sort by exposure
    vaults.sort((a, b) => b.assetsUsd - a.assetsUsd);

    // Calculate totals
    const totalExposure = vaults.reduce((sum, v) => sum + v.assetsUsd, 0);
    const vaultCount = vaults.length;

    // Calculate curator concentration
    const curatorMap = new Map<
      string,
      { name: string | null; exposure: number; vaults: number }
    >();
    for (const v of vaults) {
      if (v.curatorAddress) {
        const existing = curatorMap.get(v.curatorAddress);
        if (existing) {
          existing.exposure += v.assetsUsd;
          existing.vaults += 1;
        } else {
          curatorMap.set(v.curatorAddress, {
            name: v.curatorName,
            exposure: v.assetsUsd,
            vaults: 1,
          });
        }
      }
    }

    const curatorConcentration: CuratorConcentration[] = Array.from(
      curatorMap.entries()
    )
      .map(([addr, data]) => ({
        curatorAddress: addr,
        curatorName: data.name,
        totalExposure: data.exposure,
        vaultCount: data.vaults,
        exposurePct:
          totalExposure > 0 ? (data.exposure / totalExposure) * 100 : 0,
      }))
      .sort((a, b) => b.totalExposure - a.totalExposure);

    // Calculate asset concentration
    const assetMap = new Map<string, { exposure: number; vaults: number }>();
    for (const v of vaults) {
      const existing = assetMap.get(v.assetSymbol);
      if (existing) {
        existing.exposure += v.assetsUsd;
        existing.vaults += 1;
      } else {
        assetMap.set(v.assetSymbol, { exposure: v.assetsUsd, vaults: 1 });
      }
    }

    const assetConcentration: AssetConcentration[] = Array.from(
      assetMap.entries()
    )
      .map(([symbol, data]) => ({
        assetSymbol: symbol,
        totalExposure: data.exposure,
        vaultCount: data.vaults,
        exposurePct:
          totalExposure > 0 ? (data.exposure / totalExposure) * 100 : 0,
      }))
      .sort((a, b) => b.totalExposure - a.totalExposure);

    // Determine concentration risk
    let concentrationRisk: "low" | "medium" | "high" = "low";

    // High risk if:
    // - >70% in one curator
    // - >90% in one asset
    // - >50% in a single vault
    const topCurator = curatorConcentration[0];
    const topAsset = assetConcentration[0];
    const topVault = vaults[0];

    if (topCurator && topCurator.exposurePct > 70) {
      concentrationRisk = "high";
    } else if (topAsset && topAsset.exposurePct > 90) {
      concentrationRisk = "high";
    } else if (topVault && topVault.depositPct > 50) {
      concentrationRisk = "high";
    } else if (
      (topCurator && topCurator.exposurePct > 50) ||
      (topAsset && topAsset.exposurePct > 70) ||
      (topVault && topVault.depositPct > 30)
    ) {
      concentrationRisk = "medium";
    }

    return NextResponse.json({
      success: true,
      data: {
        userAddress: address,
        vaults,
        totalExposure,
        vaultCount,
        curatorConcentration,
        assetConcentration,
        concentrationRisk,
      },
    });
  } catch (error) {
    console.error("Error fetching user exposure:", error);
    return NextResponse.json(
      {
        success: false,
        data: {
          userAddress: "",
          vaults: [],
          totalExposure: 0,
          vaultCount: 0,
          curatorConcentration: [],
          assetConcentration: [],
          concentrationRisk: "low",
        },
        error: "Failed to fetch user exposure",
      },
      { status: 500 }
    );
  }
}

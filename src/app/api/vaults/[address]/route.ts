import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { address } = await params;

    // Fetch vault with snapshots, allocations, and curator
    const vault = await prisma.vault.findFirst({
      where: {
        address: {
          equals: address,
          mode: "insensitive",
        },
      },
      include: {
        snapshots: {
          orderBy: { timestamp: "desc" },
          take: 100,
        },
        adapterAllocations: {
          orderBy: { snapshotTime: "desc" },
        },
        curator: {
          include: {
            news: {
              orderBy: { publishedAt: "desc" },
              take: 5,
            },
            vaults: {
              include: {
                snapshots: {
                  orderBy: { timestamp: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!vault) {
      return NextResponse.json(
        { success: false, error: "Vault not found" },
        { status: 404 }
      );
    }

    // Get only the latest adapter allocations (same snapshotTime)
    const latestAllocations = getLatestAllocations(vault.adapterAllocations);

    // Calculate idle assets (totalAssets - sum of allocated assets)
    const latestSnapshot = vault.snapshots[0];
    const totalAssets = latestSnapshot ? BigInt(latestSnapshot.totalAssets) : 0n;
    const allocatedAssets = latestAllocations.reduce(
      (sum, a) => sum + BigInt(a.assets),
      0n
    );
    const idleAssets = totalAssets - allocatedAssets;
    const idleAssetsUsd = latestSnapshot
      ? (Number(idleAssets) / Number(totalAssets)) * latestSnapshot.totalAssetsUsd
      : 0;

    // Build curator data if available
    const curatorData = vault.curator
      ? {
          id: vault.curator.id,
          address: vault.curator.address,
          name: vault.curator.name,
          website: vault.curator.website,
          twitter: vault.curator.twitter,
          discord: vault.curator.discord,
          legalName: vault.curator.legalName,
          entityType: vault.curator.entityType,
          jurisdiction: vault.curator.jurisdiction,
          registeredState: vault.curator.registeredState,
          headquarters: vault.curator.headquarters,
          description: vault.curator.description,
          foundedYear: vault.curator.foundedYear,
          teamSize: vault.curator.teamSize,
          isRegulated: vault.curator.isRegulated,
          regulatoryBody: vault.curator.regulatoryBody,
          logoUrl: vault.curator.logoUrl,
          totalAssetsManaged: vault.curator.totalAssetsManaged ?? 0,
          vaultCount: vault.curator.vaultCount ?? 0,
          news: vault.curator.news.map((n) => ({
            id: n.id,
            title: n.title,
            summary: n.summary,
            url: n.url,
            source: n.source,
            publishedAt: n.publishedAt.toISOString(),
            sentiment: n.sentiment,
            category: n.category,
          })),
          otherVaults: vault.curator.vaults
            .filter((v) => v.id !== vault.id)
            .map((v) => ({
              id: v.id,
              address: v.address,
              name: v.name,
              symbol: v.symbol,
              totalAssetsUsd: v.snapshots[0]?.totalAssetsUsd ?? 0,
              avgNetApy: v.snapshots[0]?.avgNetApy ?? null,
            }))
            .sort((a, b) => b.totalAssetsUsd - a.totalAssetsUsd),
        }
      : null;

    const response = {
      id: vault.id,
      address: vault.address,
      name: vault.name,
      symbol: vault.symbol,
      chainId: vault.chainId,
      asset: {
        address: vault.assetAddress,
        symbol: vault.assetSymbol,
        decimals: vault.assetDecimals,
      },
      curatorAddress: vault.curatorAddress,
      curator: curatorData,
      fees: {
        performance: vault.performanceFee,
        management: vault.managementFee,
      },
      latestSnapshot: latestSnapshot
        ? {
            totalAssets: latestSnapshot.totalAssets,
            totalAssetsUsd: latestSnapshot.totalAssetsUsd,
            totalSupply: latestSnapshot.totalSupply,
            sharePrice: latestSnapshot.sharePrice,
            apy: latestSnapshot.apy,
            netApy: latestSnapshot.netApy,
            avgApy: latestSnapshot.avgApy,
            avgNetApy: latestSnapshot.avgNetApy,
            timestamp: latestSnapshot.timestamp.toISOString(),
          }
        : null,
      snapshotHistory: vault.snapshots.map((s) => ({
        totalAssetsUsd: s.totalAssetsUsd,
        sharePrice: s.sharePrice,
        avgNetApy: s.avgNetApy,
        timestamp: s.timestamp.toISOString(),
      })),
      adapters: latestAllocations.map((a) => ({
        address: a.adapterAddress,
        type: a.adapterType,
        assets: a.assets,
        assetsUsd: a.assetsUsd,
        allocationPct: a.allocationPct,
        snapshotTime: a.snapshotTime.toISOString(),
      })),
      idleAssets: idleAssets.toString(),
      idleAssetsUsd: idleAssetsUsd > 0 ? idleAssetsUsd : 0,
      createdAt: vault.createdAt.toISOString(),
      updatedAt: vault.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error fetching vault:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch vault" },
      { status: 500 }
    );
  }
}

// Get only allocations from the most recent snapshot
function getLatestAllocations(
  allocations: Array<{
    adapterAddress: string;
    adapterType: string;
    assets: string;
    assetsUsd: number;
    allocationPct: number;
    snapshotTime: Date;
  }>
) {
  if (allocations.length === 0) return [];

  const latestTime = allocations[0].snapshotTime.getTime();
  return allocations.filter(
    (a) => a.snapshotTime.getTime() === latestTime
  );
}

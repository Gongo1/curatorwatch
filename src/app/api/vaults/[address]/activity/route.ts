import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { address } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const type = url.searchParams.get("type"); // Filter by type

    // Find vault
    const vault = await prisma.vault.findFirst({
      where: {
        address: {
          equals: address,
          mode: "insensitive",
        },
      },
    });

    if (!vault) {
      return NextResponse.json(
        { success: false, error: "Vault not found" },
        { status: 404 }
      );
    }

    // Build type filter
    const typeFilter = type
      ? { type: { equals: type, mode: "insensitive" as const } }
      : {};

    // Fetch transactions
    const transactions = await prisma.vaultTransaction.findMany({
      where: {
        vaultId: vault.id,
        ...typeFilter,
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    });

    // Fetch reallocations (only if not filtering by deposit/withdraw)
    let reallocations: typeof transactions = [];
    if (!type || type.toLowerCase() === "reallocate") {
      reallocations = await prisma.vaultReallocation.findMany({
        where: { vaultId: vault.id },
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }).then((r) =>
        r.map((realloc) => ({
          id: realloc.id,
          vaultId: realloc.vaultId,
          txHash: realloc.txHash || "",
          blockNumber: 0,
          timestamp: realloc.timestamp,
          type: "Reallocate",
          shares: null,
          assets: realloc.amount,
          assetsUsd: realloc.amountUsd ? Number(realloc.amountUsd) : null,
          createdAt: realloc.createdAt,
        }))
      );
    }

    // Merge and sort by timestamp
    const allActivity = [...transactions, ...reallocations]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    // Format for response
    const formattedActivity = allActivity.map((item) => ({
      id: item.id,
      type: item.type,
      txHash: item.txHash,
      timestamp: item.timestamp.toISOString(),
      assets: item.assets,
      shares: item.shares,
      assetsUsd: item.assetsUsd,
      etherscanUrl: item.txHash
        ? `https://etherscan.io/tx/${item.txHash}`
        : null,
    }));

    // Get total count for pagination
    const totalTransactions = await prisma.vaultTransaction.count({
      where: { vaultId: vault.id, ...typeFilter },
    });
    const totalReallocations =
      !type || type.toLowerCase() === "reallocate"
        ? await prisma.vaultReallocation.count({ where: { vaultId: vault.id } })
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        activity: formattedActivity,
        pagination: {
          total: totalTransactions + totalReallocations,
          limit,
          offset,
          hasMore: offset + limit < totalTransactions + totalReallocations,
        },
      },
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Error fetching vault activity:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}

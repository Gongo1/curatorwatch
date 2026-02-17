import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { address } = await params;
    const url = new URL(request.url);
    const range = url.searchParams.get("range") || "30d";

    // Calculate date range
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

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

    // Fetch transactions within the date range
    const transactions = await prisma.vaultTransaction.findMany({
      where: {
        vaultId: vault.id,
        timestamp: { gte: startDate },
        type: { in: ["Deposit", "Withdraw"] },
      },
      orderBy: { timestamp: "asc" },
    });

    // Group by day
    const dailyData: Record<string, { deposits: number; withdrawals: number }> = {};

    // Initialize all days in the range
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split("T")[0];
      dailyData[dateKey] = { deposits: 0, withdrawals: 0 };
    }

    // Aggregate transactions by day
    for (const tx of transactions) {
      const dateKey = tx.timestamp.toISOString().split("T")[0];

      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { deposits: 0, withdrawals: 0 };
      }

      // Use assetsUsd if available, otherwise estimate from assets
      const amount = tx.assetsUsd || 0;

      if (tx.type === "Deposit") {
        dailyData[dateKey].deposits += amount;
      } else if (tx.type === "Withdraw") {
        dailyData[dateKey].withdrawals += amount;
      }
    }

    // Convert to sorted array
    const chartData = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        deposits: Math.round(data.deposits * 100) / 100,
        withdrawals: Math.round(data.withdrawals * 100) / 100,
        netFlow: Math.round((data.deposits - data.withdrawals) * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate totals
    const totals = chartData.reduce(
      (acc, d) => ({
        deposits: acc.deposits + d.deposits,
        withdrawals: acc.withdrawals + d.withdrawals,
        netFlow: acc.netFlow + d.netFlow,
      }),
      { deposits: 0, withdrawals: 0, netFlow: 0 }
    );

    return NextResponse.json({
      success: true,
      data: chartData,
      totals,
      range,
      vaultName: vault.name,
    });
  } catch (error) {
    console.error("Error fetching transaction volume:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transaction volume" },
      { status: 500 }
    );
  }
}

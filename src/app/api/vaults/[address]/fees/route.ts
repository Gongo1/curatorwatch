import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteParams {
  params: Promise<{ address: string }>;
}

// Morpho protocol fee (typically 15% of interest earned goes to protocol)
const MORPHO_PROTOCOL_FEE_RATE = 0.15;

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { address } = await params;

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
          take: 30, // Last 30 snapshots for time-weighted calculation
        },
        curator: {
          select: {
            name: true,
            address: true,
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

    const latestSnapshot = vault.snapshots[0];
    const tvl = latestSnapshot?.totalAssetsUsd || 0;
    const apy = latestSnapshot?.avgNetApy || 0;

    // Calculate time in operation (in years)
    const vaultAge = vault.createdAt
      ? (Date.now() - new Date(vault.createdAt).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      : 1;
    const operatingYears = Math.min(vaultAge, 1); // Cap at 1 year for estimates

    // Estimated gross APY (before fees) - net APY is after curator fees
    // grossAPY = netAPY / (1 - performanceFee) approximately
    const performanceFee = vault.performanceFee || 0;
    const managementFee = vault.managementFee || 0;
    const grossApy = performanceFee > 0 ? apy / (1 - performanceFee) : apy;
    // grossApy is already a decimal (e.g. 0.05 = 5%), no need to divide by 100
    const grossYield = grossApy;

    // Calculate estimated fees
    // Management fees: TVL × managementFee × time
    const estimatedManagementFees = tvl * managementFee * operatingYears;

    // Performance fees: TVL × grossYield × performanceFee × time
    const estimatedPerformanceFees = tvl * grossYield * performanceFee * operatingYears;

    // Total curator fees
    const totalCuratorFees = estimatedManagementFees + estimatedPerformanceFees;

    // Morpho protocol fees: estimated as % of total interest earned
    // Interest earned ≈ TVL × grossYield × time
    const totalInterestEarned = tvl * grossYield * operatingYears;
    const morphoFees = totalInterestEarned * MORPHO_PROTOCOL_FEE_RATE;

    // Annualized projections
    const annualizedCuratorFees = operatingYears > 0 ? totalCuratorFees / operatingYears : 0;
    const annualizedMorphoFees = operatingYears > 0 ? morphoFees / operatingYears : 0;

    return NextResponse.json({
      success: true,
      data: {
        vault: {
          name: vault.name,
          address: vault.address,
          tvl,
          apy,
          grossApy,
        },
        feeRates: {
          performanceFee: performanceFee * 100, // As percentage
          managementFee: managementFee * 100,   // As percentage
          morphoProtocolFee: MORPHO_PROTOCOL_FEE_RATE * 100,
        },
        curator: {
          name: vault.curator?.name || "Unknown",
          address: vault.curator?.address || null,
        },
        estimatedFees: {
          period: `${(operatingYears * 12).toFixed(1)} months`,
          curatorFees: {
            management: estimatedManagementFees,
            performance: estimatedPerformanceFees,
            total: totalCuratorFees,
          },
          morphoFees,
          totalFees: totalCuratorFees + morphoFees,
        },
        annualized: {
          curatorFees: annualizedCuratorFees,
          morphoFees: annualizedMorphoFees,
          totalFees: annualizedCuratorFees + annualizedMorphoFees,
        },
      },
    });
  } catch (error) {
    console.error("Error calculating fees:", error);
    return NextResponse.json(
      { success: false, error: "Failed to calculate fees" },
      { status: 500 }
    );
  }
}

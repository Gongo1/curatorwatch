import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Severity } from "@/lib/change-thresholds";

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { address } = await params;
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get("hours") || "168"); // Default 7 days
    const severity = url.searchParams.get("severity") as Severity | null;
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

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

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const where = {
      vaultId: vault.id,
      detectedAt: { gte: since },
      ...(severity && { severity }),
    };

    // Get changes
    const [changes, total] = await Promise.all([
      prisma.vaultChange.findMany({
        where,
        orderBy: { detectedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.vaultChange.count({ where }),
    ]);

    // Get summary counts for this vault
    const counts = await prisma.vaultChange.groupBy({
      by: ["severity"],
      where: {
        vaultId: vault.id,
        detectedAt: { gte: since },
      },
      _count: true,
    });

    const summary = {
      critical: counts.find((c) => c.severity === "critical")?._count || 0,
      warning: counts.find((c) => c.severity === "warning")?._count || 0,
      info: counts.find((c) => c.severity === "info")?._count || 0,
      total: counts.reduce((sum, c) => sum + c._count, 0),
    };

    // Format for response
    const formattedChanges = changes.map((change) => ({
      id: change.id,
      changeType: change.changeType,
      severity: change.severity,
      title: change.title,
      description: change.description,
      oldValue: change.oldValue,
      newValue: change.newValue,
      metadata: change.metadata,
      detectedAt: change.detectedAt.toISOString(),
      viewed: change.viewed,
    }));

    return NextResponse.json({
      success: true,
      data: {
        changes: formattedChanges,
        summary,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching vault changes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch changes" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Severity } from "@/lib/change-thresholds";

interface GetChangesOptions {
  hours?: number;
  severity?: Severity;
  vaultId?: string;
  limit?: number;
  offset?: number;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get("hours") || "24");
    const severity = url.searchParams.get("severity") as Severity | null;
    const vaultId = url.searchParams.get("vaultId");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Build where clause
    const where: {
      detectedAt: { gte: Date };
      severity?: Severity;
      vaultId?: string;
    } = {
      detectedAt: { gte: since },
    };

    if (severity) {
      where.severity = severity;
    }

    if (vaultId) {
      where.vaultId = vaultId;
    }

    // Get changes with pagination
    const [changes, total, summaryCounts] = await Promise.all([
      prisma.vaultChange.findMany({
        where,
        orderBy: { detectedAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          vaultId: true,
          changeType: true,
          severity: true,
          title: true,
          description: true,
          oldValue: true,
          newValue: true,
          metadata: true,
          detectedAt: true,
          viewed: true,
          vault: {
            select: { name: true, symbol: true, address: true },
          },
        },
      }),
      prisma.vaultChange.count({ where }),
      prisma.vaultChange.groupBy({
        by: ["severity"],
        where: { detectedAt: { gte: since } },
        _count: { severity: true },
      }),
    ]);

    // Build summary
    const summary = {
      critical: 0,
      warning: 0,
      info: 0,
      total,
    };

    for (const count of summaryCounts) {
      if (count.severity === "critical") summary.critical = count._count.severity;
      if (count.severity === "warning") summary.warning = count._count.severity;
      if (count.severity === "info") summary.info = count._count.severity;
    }

    // Format for response
    const formattedChanges = changes.map((change) => ({
      id: change.id,
      vaultId: change.vaultId,
      vault: {
        name: change.vault.name,
        symbol: change.vault.symbol,
        address: change.vault.address,
      },
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

    return NextResponse.json(
      {
        success: true,
        data: {
          changes: formattedChanges,
          summary,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + changes.length < total,
          },
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching changes:", error);
    return NextResponse.json(
      {
        success: false,
        data: {
          changes: [],
          summary: { critical: 0, warning: 0, info: 0, total: 0 },
          pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
        },
        error: "Failed to fetch changes"
      },
      { status: 500 }
    );
  }
}

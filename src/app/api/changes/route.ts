import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Severity } from "@/lib/change-thresholds";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get("hours") || "24");
    const severity = url.searchParams.get("severity") as Severity | null;
    const vaultId = url.searchParams.get("vaultId");
    const scope = url.searchParams.get("scope") || "all"; // "all" | "vault" | "curator" | "ecosystem"
    const curatorId = url.searchParams.get("curatorId");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Collect results from both tables based on scope
    type FormattedChange = {
      id: string;
      scope: "vault" | "curator" | "ecosystem";
      vaultId: string | null;
      vault: { name: string; symbol: string; address: string } | null;
      curatorId: string | null;
      curator: { name: string | null } | null;
      changeType: string;
      severity: string;
      title: string;
      description: string;
      oldValue: string | null;
      newValue: string | null;
      metadata: Prisma.JsonValue | null;
      detectedAt: string;
      viewed: boolean;
    };

    let allChanges: FormattedChange[] = [];
    let vaultTotal = 0;
    let platformTotal = 0;

    // 1. Query VaultChange (vault-scoped alerts)
    if (scope === "all" || scope === "vault") {
      const vaultWhere: Prisma.VaultChangeWhereInput = {
        detectedAt: { gte: since },
      };
      if (severity) vaultWhere.severity = severity;
      if (vaultId) vaultWhere.vaultId = vaultId;

      const [vaultChanges, vaultCount] = await Promise.all([
        prisma.vaultChange.findMany({
          where: vaultWhere,
          orderBy: { detectedAt: "desc" },
          take: limit + offset, // Fetch enough for merged pagination
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
        prisma.vaultChange.count({ where: vaultWhere }),
      ]);

      vaultTotal = vaultCount;

      for (const change of vaultChanges) {
        allChanges.push({
          id: change.id,
          scope: "vault",
          vaultId: change.vaultId,
          vault: change.vault,
          curatorId: null,
          curator: null,
          changeType: change.changeType,
          severity: change.severity,
          title: change.title,
          description: change.description,
          oldValue: change.oldValue,
          newValue: change.newValue,
          metadata: change.metadata,
          detectedAt: change.detectedAt.toISOString(),
          viewed: change.viewed,
        });
      }
    }

    // 2. Query PlatformAlert (curator + ecosystem scoped alerts)
    if (scope === "all" || scope === "curator" || scope === "ecosystem") {
      const platformWhere: Prisma.PlatformAlertWhereInput = {
        detectedAt: { gte: since },
      };
      if (severity) platformWhere.severity = severity;
      if (curatorId) platformWhere.curatorId = curatorId;

      // Filter by scope if specific
      if (scope === "curator") {
        platformWhere.scope = "curator";
      } else if (scope === "ecosystem") {
        platformWhere.scope = "ecosystem";
      }

      const [platformAlerts, platformCount] = await Promise.all([
        prisma.platformAlert.findMany({
          where: platformWhere,
          orderBy: { detectedAt: "desc" },
          take: limit + offset,
          select: {
            id: true,
            scope: true,
            curatorId: true,
            changeType: true,
            severity: true,
            title: true,
            description: true,
            oldValue: true,
            newValue: true,
            metadata: true,
            detectedAt: true,
            viewed: true,
            curator: {
              select: { name: true },
            },
          },
        }),
        prisma.platformAlert.count({ where: platformWhere }),
      ]);

      platformTotal = platformCount;

      for (const alert of platformAlerts) {
        allChanges.push({
          id: alert.id,
          scope: alert.scope as "curator" | "ecosystem",
          vaultId: null,
          vault: null,
          curatorId: alert.curatorId,
          curator: alert.curator,
          changeType: alert.changeType,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          oldValue: alert.oldValue,
          newValue: alert.newValue,
          metadata: alert.metadata,
          detectedAt: alert.detectedAt.toISOString(),
          viewed: alert.viewed,
        });
      }
    }

    // Sort merged results by detectedAt desc and apply pagination
    allChanges.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
    const paginatedChanges = allChanges.slice(offset, offset + limit);
    const total = vaultTotal + platformTotal;

    // Build summary counts from both tables
    const summary = { critical: 0, warning: 0, info: 0, total };

    if (scope === "all" || scope === "vault") {
      const vaultCounts = await prisma.vaultChange.groupBy({
        by: ["severity"],
        where: { detectedAt: { gte: since } },
        _count: { severity: true },
      });
      for (const count of vaultCounts) {
        if (count.severity === "critical") summary.critical += count._count.severity;
        if (count.severity === "warning") summary.warning += count._count.severity;
        if (count.severity === "info") summary.info += count._count.severity;
      }
    }
    if (scope === "all" || scope === "curator" || scope === "ecosystem") {
      const platformCounts = await prisma.platformAlert.groupBy({
        by: ["severity"],
        where: { detectedAt: { gte: since } },
        _count: { severity: true },
      });
      for (const count of platformCounts) {
        if (count.severity === "critical") summary.critical += count._count.severity;
        if (count.severity === "warning") summary.warning += count._count.severity;
        if (count.severity === "info") summary.info += count._count.severity;
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          changes: paginatedChanges,
          summary,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + paginatedChanges.length < total,
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Severity } from "@/lib/change-thresholds";
import type { Prisma } from "@prisma/client";
import { resolveCuratorSlug } from "@/lib/curator-aliases";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get("hours") || "24");
    const severity = url.searchParams.get("severity") as Severity | null;
    const vaultId = url.searchParams.get("vaultId");
    const scope = url.searchParams.get("scope") || "all"; // "all" | "vault" | "curator" | "ecosystem"
    const curatorIdParam = url.searchParams.get("curatorId");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Portfolio filtering params
    const vaultAddressesParam = url.searchParams.get("vaultAddresses");
    const curatorIdsParam = url.searchParams.get("curatorIds");
    const vaultAddresses = vaultAddressesParam ? vaultAddressesParam.split(",").filter(Boolean) : [];
    const curatorIds = curatorIdsParam ? curatorIdsParam.split(",").filter(Boolean) : [];

    // Resolve curatorId from slug if provided
    let curatorId = curatorIdParam;
    if (curatorIdParam && !curatorIdParam.startsWith("cl")) {
      // Looks like a slug, resolve to address then look up DB id
      const resolvedAddress = await resolveCuratorSlug(curatorIdParam);
      const curatorRow = await prisma.curator.findFirst({
        where: { address: resolvedAddress },
        select: { id: true },
      });
      curatorId = curatorRow?.id ?? curatorIdParam;
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Collect results from both tables based on scope
    type FormattedChange = {
      id: string;
      scope: "vault" | "curator" | "ecosystem";
      vaultId: string | null;
      vault: { name: string; symbol: string; address: string; curator?: { name: string | null; id: string } | null } | null;
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
      if (curatorId) vaultWhere.vault = { curatorId };

      // Portfolio filtering: show alerts for tracked vaults OR tracked curators
      if (vaultAddresses.length || curatorIds.length) {
        vaultWhere.OR = [
          ...(vaultAddresses.length ? [{ vault: { address: { in: vaultAddresses } } }] : []),
          ...(curatorIds.length ? [{ vault: { curatorId: { in: curatorIds } } }] : []),
        ];
      }

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
              select: { name: true, symbol: true, address: true, curator: { select: { name: true, id: true } } },
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
          vault: { name: change.vault.name, symbol: change.vault.symbol, address: change.vault.address, curator: change.vault.curator },
          curatorId: change.vault.curator?.id ?? null,
          curator: change.vault.curator ? { name: change.vault.curator.name } : null,
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
      if (curatorId && !curatorIds.length) platformWhere.curatorId = curatorId;

      // Portfolio filtering: show alerts for tracked curators + always include ecosystem
      if (curatorIds.length) {
        platformWhere.OR = [
          { curatorId: { in: curatorIds } },
          { scope: "ecosystem" },
        ];
      }

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

    // Curator alert counts for dropdown filter
    const curatorAlertCountMap = new Map<string, { id: string; name: string; count: number }>();

    // Count vault alerts per curator
    const vaultCuratorCounts = await prisma.vaultChange.groupBy({
      by: ["vaultId"],
      where: { detectedAt: { gte: since } },
      _count: { id: true },
    });
    if (vaultCuratorCounts.length > 0) {
      const vaultsWithCurator = await prisma.vault.findMany({
        where: { id: { in: vaultCuratorCounts.map((v) => v.vaultId) } },
        select: { id: true, curatorId: true, curator: { select: { id: true, name: true } } },
      });
      const vaultCuratorMap = new Map(vaultsWithCurator.map((v) => [v.id, v]));
      for (const vc of vaultCuratorCounts) {
        const vault = vaultCuratorMap.get(vc.vaultId);
        if (vault?.curator) {
          const existing = curatorAlertCountMap.get(vault.curator.id);
          if (existing) {
            existing.count += vc._count.id;
          } else {
            curatorAlertCountMap.set(vault.curator.id, {
              id: vault.curator.id,
              name: vault.curator.name ?? "Unknown",
              count: vc._count.id,
            });
          }
        }
      }
    }

    // Count platform alerts per curator
    const platformCuratorCounts = await prisma.platformAlert.groupBy({
      by: ["curatorId"],
      where: { detectedAt: { gte: since }, curatorId: { not: null } },
      _count: { id: true },
    });
    for (const pc of platformCuratorCounts) {
      if (!pc.curatorId) continue;
      const existing = curatorAlertCountMap.get(pc.curatorId);
      if (existing) {
        existing.count += pc._count.id;
      } else {
        // Need to look up curator name
        const curator = await prisma.curator.findUnique({
          where: { id: pc.curatorId },
          select: { name: true },
        });
        curatorAlertCountMap.set(pc.curatorId, {
          id: pc.curatorId,
          name: curator?.name ?? "Unknown",
          count: pc._count.id,
        });
      }
    }

    const curatorAlertCounts = Array.from(curatorAlertCountMap.values())
      .sort((a, b) => b.count - a.count);

    return NextResponse.json(
      {
        success: true,
        data: {
          changes: paginatedChanges,
          summary,
          curatorAlertCounts,
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

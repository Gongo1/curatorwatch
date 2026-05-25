import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/cache";
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

    // Check cache
    const cacheKey = `changes:${hours}:${severity || ""}:${vaultId || ""}:${scope}:${curatorIdParam || ""}:${limit}:${offset}:${vaultAddressesParam || ""}:${curatorIdsParam || ""}`;
    const cached = await cacheGet<object>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      });
    }

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

      const vaultChanges = await prisma.vaultChange.findMany({
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
      });
      const vaultCount = vaultChanges.length;

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

      const platformAlerts = await prisma.platformAlert.findMany({
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
      });
      const platformCount = platformAlerts.length;

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

    // Build summary counts from already-fetched data (no extra DB queries)
    const summary = { critical: 0, warning: 0, info: 0, total };

    for (const change of allChanges) {
      if (change.severity === "critical") summary.critical++;
      else if (change.severity === "warning") summary.warning++;
      else if (change.severity === "info") summary.info++;
    }

    // Compute curator alert counts from already-fetched data (no extra DB queries)
    const curatorAlertCountMap = new Map<string, { id: string; name: string; count: number }>();

    for (const change of allChanges) {
      const cId = change.curatorId;
      const cName = change.curator?.name ?? "Unknown";
      if (!cId) continue;

      const existing = curatorAlertCountMap.get(cId);
      if (existing) {
        existing.count++;
      } else {
        curatorAlertCountMap.set(cId, { id: cId, name: cName, count: 1 });
      }
    }

    const curatorAlertCounts = Array.from(curatorAlertCountMap.values())
      .sort((a, b) => b.count - a.count);

    const responseData = {
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
    };

    await cacheSet(cacheKey, responseData, 120);

    return NextResponse.json(
      responseData,
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

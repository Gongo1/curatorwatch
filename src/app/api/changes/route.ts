import { NextResponse } from "next/server";
import { getRecentChanges, getChangeSummary } from "@/lib/change-detector";
import type { Severity } from "@/lib/change-thresholds";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hours = parseInt(url.searchParams.get("hours") || "24");
    const severity = url.searchParams.get("severity") as Severity | null;
    const vaultId = url.searchParams.get("vaultId");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Get changes with pagination
    const { changes, pagination } = await getRecentChanges({
      hours,
      severity: severity || undefined,
      vaultId: vaultId || undefined,
      limit,
      offset,
    });

    // Get summary counts
    const summary = await getChangeSummary(hours);

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

    return NextResponse.json({
      success: true,
      data: {
        changes: formattedChanges,
        summary,
        pagination,
      },
    });
  } catch (error) {
    console.error("Error fetching changes:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch changes" },
      { status: 500 }
    );
  }
}

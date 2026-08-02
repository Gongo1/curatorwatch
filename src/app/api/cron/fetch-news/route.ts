import { NextRequest, NextResponse } from "next/server";
import { fetchNews } from "@/lib/news/fetch-news";
import { revalidateDataPages } from "@/lib/revalidate-pages";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Newswire ingest — its own cron (vercel.json, every 6h). Formerly a step in
 * /api/cron/collect's alt lane, where its ~40 feed fetches + per-item upserts
 * blew the shared budget (FUNCTION_INVOCATION_TIMEOUT) and silently starved
 * the steps behind it.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const urlSecret = request.nextUrl.searchParams.get("secret");
    if (authHeader !== `Bearer ${cronSecret}` && urlSecret !== cronSecret) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await fetchNews();
    console.log("[CRON] News ingest:", result);
    revalidateDataPages();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[CRON] News ingest failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "News ingest failed" },
      { status: 500 }
    );
  }
}

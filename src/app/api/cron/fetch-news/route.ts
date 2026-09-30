import { NextRequest, NextResponse } from "next/server";
import { fetchNews } from "@/lib/news/fetch-news";
import { revalidateDataPages } from "@/lib/revalidate-pages";
import { withCronRun } from "@/lib/cron-run";

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

  return withCronRun("fetch-news", async () => {
    const result = await fetchNews();
    console.log("[CRON] News ingest:", result);
    revalidateDataPages();

    // Individual feeds fail all the time (sparse by design), but every feed
    // failing means the ingest is broken, not quiet.
    const stepErrors: Record<string, string> = {};
    if (result.feedsOk === 0 && result.feedsFailed > 0) {
      stepErrors.feeds = `all ${result.feedsFailed} RSS feeds failed`;
    }
    if (result.curatorFeedsOk === 0 && result.curatorFeedsFailed > 0) {
      stepErrors.curatorFeeds = `all ${result.curatorFeedsFailed} curator feeds failed`;
    }
    return { rowsWritten: result.upserted, stepErrors, body: { result } };
  });
}

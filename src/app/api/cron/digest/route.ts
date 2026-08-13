import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { buildDigest } from "@/lib/digest/build";
import { renderMarkdown, renderTitle, renderSummary } from "@/lib/digest/render";
import { generateDigestProse } from "@/lib/digest/generate";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Nightly Curator Daily digest. Builds the structured DigestData from existing tables,
 * renders the prose (deterministic template, or Claude when DIGEST_LLM_ENABLED), and
 * upserts one row per UTC day (idempotent on slug). No external posting.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const urlSecret = request.nextUrl.searchParams.get("secret");

  if (cronSecret) {
    const isValidAuth = authHeader === `Bearer ${cronSecret}`;
    const isValidQuery = urlSecret === cronSecret;
    if (!isValidAuth && !isValidQuery) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const data = await buildDigest(now);

    // Prose: Claude when enabled (pharos model), else the deterministic template.
    let bodyMarkdown = renderMarkdown(data);
    let generatedBy = "template";
    try {
      const gen = await generateDigestProse(data);
      if (gen) {
        bodyMarkdown = gen.bodyMarkdown;
        generatedBy = gen.generatedBy;
      }
    } catch (e) {
      console.error("[CRON] digest LLM generation failed, using template:", e);
    }

    const title = renderTitle(data);
    const summary = renderSummary(data);

    const digest = await prisma.digest.upsert({
      where: { slug: data.slug },
      create: {
        slug: data.slug,
        date: now,
        title,
        summary,
        bodyMarkdown,
        structuredJson: data as unknown as object,
        generatedBy,
        stressScore: data.stress.score,
        stressBand: data.stress.band,
        published: true,
      },
      update: {
        date: now,
        title,
        summary,
        bodyMarkdown,
        structuredJson: data as unknown as object,
        generatedBy,
        stressScore: data.stress.score,
        stressBand: data.stress.band,
      },
    });

    revalidatePath("/digest");
    revalidatePath("/feed/digest.xml");

    return NextResponse.json({
      success: true,
      slug: digest.slug,
      generatedBy,
      stress: { score: data.stress.score, band: data.stress.band },
      sections: {
        inflows: data.topInflows.length,
        outflows: data.topOutflows.length,
        newVaults: data.newVaults.length,
        yieldMovers: data.yieldMovers.length,
        incidents: data.incidents.count,
        news: data.news?.length ?? 0,
        spotlight: data.spotlight?.name ?? null,
      },
    });
  } catch (error) {
    console.error("[CRON] Digest build failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to build digest" },
      { status: 500 }
    );
  }
}

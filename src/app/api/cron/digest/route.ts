import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { buildDigest, digestBlockers } from "@/lib/digest/build";
import { renderMarkdown, renderTitle, renderSummary } from "@/lib/digest/render";
import { generateDigestProse } from "@/lib/digest/generate";
import { withCronRun } from "@/lib/cron-run";
import { freshnessBreaches, getSourceFreshness } from "@/lib/health/freshness";
import { qualityBreaches, runQualityChecks } from "@/lib/health/quality";
import { sendAdminEmail } from "@/lib/health/report";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Nightly Curator Daily digest. Builds the structured DigestData from existing tables,
 * renders the prose (deterministic template, or Claude when DIGEST_LLM_ENABLED), and
 * upserts one row per UTC day (idempotent on slug). No external posting.
 * Refuses to publish on stale Morpho/Turtle data or a failed quality check.
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

  return withCronRun("digest", async () => {
    const now = new Date();
    const slug = now.toISOString().slice(0, 10);

    // Guard: never publish on stale or failing data. Morpho or Turtle past SLA
    // (or under coverage) or any failed quality assertion → no edition, HTTP
    // 500, admin email. The 05:30 delivery then refuses to re-send yesterday's.
    const sources = await getSourceFreshness(now);
    const quality = await runQualityChecks(now);
    const blockers = digestBlockers([
      ...freshnessBreaches(sources),
      ...qualityBreaches(quality),
    ]);
    if (blockers.length > 0) {
      const mail = await sendAdminEmail(
        `[CuratorWatch] Curator Daily ${slug} NOT published (${blockers.length} blocker${blockers.length === 1 ? "" : "s"})`,
        blockers.map((b) => b.message)
      );
      return {
        error: `digest refused: ${blockers.map((b) => b.message).join("; ")}`,
        stepErrors: mail.sent ? undefined : { adminEmail: mail.reason ?? "admin email failed" },
        body: { refused: true, slug, blockers },
      };
    }

    const data = await buildDigest(now, sources);

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

    return {
      rowsWritten: 1,
      body: {
        slug: digest.slug,
        generatedBy,
        stress: { score: data.stress.score, band: data.stress.band },
        excludedSources: data.excludedSources,
        sections: {
          inflows: data.topInflows.length,
          outflows: data.topOutflows.length,
          newVaults: data.newVaults.length,
          yieldMovers: data.yieldMovers.length,
          incidents: data.incidents.count,
          incidentsStale: data.incidents.stale ?? false,
          news: data.news?.length ?? 0,
          spotlight: data.spotlight?.name ?? null,
        },
      },
    };
  });
}

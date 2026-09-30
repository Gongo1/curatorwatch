/**
 * Cron run log + fail-loud wrapper for every /api/cron/* route.
 *
 * withCronRun() writes a CronRun row ("running") before the job starts and
 * finishes it with ok | partial | error. The HTTP status follows the run
 * status: 200 only when the run is "ok", else 500 with a JSON error. A source
 * failure can no longer hide behind `success: true` (Turtle 401s, the V2 schema
 * break and the liquidations break all ran for weeks behind HTTP 200s).
 *
 * A row that stays "running" far past the function's maxDuration means Vercel
 * killed the invocation (timeout / 504); the health check reports it as stuck.
 *
 * The run log is best-effort: if the CronRun write fails (e.g. the table is not
 * created yet) the job still runs, and the response carries `cronLogError`.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export type CronRunStatus = "running" | "ok" | "partial" | "error";

export interface CronOutcome {
  /** Rows the run wrote (snapshots, upserts, emails, ...), for the run log. */
  rowsWritten?: number;
  /** Non-fatal step failures: the run went on but did not do everything → "partial". */
  stepErrors?: Record<string, string>;
  /** Fatal failure: the job's main work did not happen → "error". */
  error?: string;
  /** Extra JSON for the HTTP response (summaries, counts). */
  body?: Record<string, unknown>;
}

const MAX_ERROR_CHARS = 2000;

function message(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, MAX_ERROR_CHARS);
}

export async function withCronRun(
  job: string,
  fn: () => Promise<CronOutcome>,
  opts: { lane?: string | null } = {}
): Promise<NextResponse> {
  const lane = opts.lane ?? null;
  const label = lane ? `${job}:${lane}` : job;
  const startedAt = new Date();
  let runId: string | null = null;
  let cronLogError: string | null = null;

  try {
    const row = await prisma.cronRun.create({
      data: { job, lane, startedAt, status: "running" },
      select: { id: true },
    });
    runId = row.id;
  } catch (e) {
    cronLogError = message(e);
    console.error(`[cron-run] ${label}: CronRun write failed (job still runs):`, e);
  }

  let outcome: CronOutcome;
  try {
    outcome = await fn();
  } catch (e) {
    console.error(`[CRON] ${label} failed:`, e);
    outcome = { error: message(e) };
  }

  const stepErrors =
    outcome.stepErrors && Object.keys(outcome.stepErrors).length > 0
      ? outcome.stepErrors
      : undefined;
  const status: CronRunStatus = outcome.error ? "error" : stepErrors ? "partial" : "ok";
  const error =
    outcome.error?.slice(0, MAX_ERROR_CHARS) ??
    (stepErrors
      ? Object.entries(stepErrors)
          .map(([step, msg]) => `${step}: ${msg}`)
          .join("; ")
          .slice(0, MAX_ERROR_CHARS)
      : undefined);

  if (runId) {
    try {
      await prisma.cronRun.update({
        where: { id: runId },
        data: {
          finishedAt: new Date(),
          status,
          rowsWritten: outcome.rowsWritten ?? null,
          stepErrors,
          // Partial runs store their joined step errors too: the health check
          // reads this column, and would otherwise say "no error text".
          error: error ?? null,
        },
      });
    } catch (e) {
      cronLogError = message(e);
      console.error(`[cron-run] ${label}: CronRun finish write failed:`, e);
    }
  }

  const ok = status === "ok";
  if (!ok) console.error(`[CRON] ${label} finished ${status}:`, error);

  return NextResponse.json(
    {
      ...outcome.body,
      success: ok,
      job,
      lane,
      status,
      ...(error ? { error } : {}),
      ...(stepErrors ? { stepErrors } : {}),
      rowsWritten: outcome.rowsWritten ?? null,
      durationMs: Date.now() - startedAt.getTime(),
      cronRunId: runId,
      ...(cronLogError ? { cronLogError } : {}),
    },
    { status: ok ? 200 : 500 }
  );
}

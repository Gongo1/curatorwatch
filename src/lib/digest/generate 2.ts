/**
 * Optional Claude-authored prose for the digest — the pharos model (Claude over a
 * fixed prompt + the structured daily JSON). DISABLED by default and OFF unless BOTH
 * DIGEST_LLM_ENABLED="true" AND ANTHROPIC_API_KEY are set, so v1 ships on the
 * deterministic template (render.ts) with zero new dependencies and zero external
 * calls. No Telegram/X posting happens anywhere — distribution is the on-site /digest
 * page + RSS only.
 *
 * Uses fetch() against the Anthropic Messages API directly (no SDK) so enabling it is
 * a pure env-var flip. The scores still make every claim; the model only writes prose.
 */

import type { DigestData } from "./types";

const MODEL = process.env.DIGEST_LLM_MODEL ?? "claude-opus-4-8";

export interface GeneratedDigest {
  bodyMarkdown: string;
  generatedBy: string;
}

export function digestLlmEnabled(): boolean {
  return process.env.DIGEST_LLM_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY;
}

function buildPrompt(data: DigestData): string {
  return [
    "You are the writer of CuratorWatch's daily \"Curator Daily\" digest about DeFi vault curators (the risk teams behind lending vaults).",
    "Voice: Bloomberg-meets-crypto-Twitter — metric-driven, dry wit, opinionated but never hype. 350–550 words. Markdown.",
    "Rules: every claim must be grounded in the JSON below — do NOT invent numbers. Lead with the single biggest story. Reference curators/vaults by name. End with a one-line 'Watching:' forward-look and a 'not investment advice' note.",
    "Here is today's structured data (the source of truth):",
    "```json",
    JSON.stringify(data, null, 2),
    "```",
    "Write only the digest body in markdown. No preamble.",
  ].join("\n");
}

export async function generateDigestProse(data: DigestData): Promise<GeneratedDigest | null> {
  if (!digestLlmEnabled()) return null;
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1600,
        messages: [{ role: "user", content: buildPrompt(data) }],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: { text?: string }[] };
    const text = json?.content?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) return null;
    return { bodyMarkdown: text.trim(), generatedBy: MODEL };
  } catch {
    return null;
  }
}

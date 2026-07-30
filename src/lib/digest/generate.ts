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
import { DESK_EDITOR_PROMPT } from "./editor-prompt";

const MODEL = process.env.DIGEST_LLM_MODEL ?? "claude-opus-4-8";

export interface GeneratedDigest {
  bodyMarkdown: string;
  generatedBy: string;
}

export function digestLlmEnabled(): boolean {
  return process.env.DIGEST_LLM_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY;
}

export function buildUserTurn(data: DigestData): string {
  return [
    "Today's payload (the sole source of truth):",
    "```json",
    JSON.stringify(data, null, 2),
    "```",
    "Write today's edition now.",
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
        max_tokens: 4000,
        thinking: { type: "adaptive" },
        // Stable system prompt first (prompt-cacheable), volatile payload in
        // the user turn.
        system: [
          {
            type: "text",
            text: DESK_EDITOR_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: buildUserTurn(data) }],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: { type?: string; text?: string }[] };
    const text = json?.content?.find((b) => b.type === "text")?.text;
    if (typeof text !== "string" || !text.trim()) return null;
    return { bodyMarkdown: text.trim(), generatedBy: MODEL };
  } catch {
    return null;
  }
}

// Account-gate feature flag. NEXT_PUBLIC_ so it's a build-time constant on the
// client (stable hook order for the flag-switched components) and readable
// server-side in routes/middleware. Ships dark until flipped in Vercel.
export const GATE_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_ACCOUNT_GATE === "true";

/** Rows anonymous users see in the curator ranking. Hard-wall policy
 *  (2026-07-28): home + top 3 only; everything else requires an account. */
export const FREE_RANKING_ROWS = 3;

/** Below-the-fold curator names surfaced as *text* in the gate overlay
 *  ("Sentora, K3 Capital + N more"). Names only — never row data. */
export const TEASE_NAMES = 3;

/** Google OAuth button. Ships dark until the Google social connection is
 *  configured on the Clerk instance (prod needs custom OAuth credentials). */
export const GOOGLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_GOOGLE_AUTH === "true";

export const HANDLE_RE = /^[a-z0-9-]{3,20}$/;

/** Post-auth return destinations must be same-origin paths (no open redirects). */
export function safeNextPath(raw: string | null): string | null {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

/** Truncation metadata attached to gated ranking payloads (server-derived). */
export interface RankingGateMeta {
  truncated: boolean;
  totalCount: number;
  teaseNames: (string | null)[];
}

/** Derive the pre-filled handle suggestion from an email local part. */
export function suggestHandle(email: string): string {
  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : `user-${base}`.slice(0, 20);
}

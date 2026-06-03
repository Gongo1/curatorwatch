"use client";

/**
 * Authenticated browser client for the Turtle Earn API (distributor deposit flow).
 *
 * Base: https://earn.turtle.xyz/v1. Auth: `Authorization: Bearer <pk_live_…>` — a
 * publishable, origin-validated key, safe to use from the browser (Bearer avoids the
 * CORS preflight that the custom X-API-Key header would trigger).
 *
 * Separate from ./client.ts, which is the UNauthenticated opportunities fetch used by
 * the ingestion cron. This module powers the user-facing deposit embed at /deposit.
 *
 * Shapes below reflect the LIVE payloads (validated against the running API on
 * 2026-06-03), which differ from the docs in two ways worth noting:
 *   - There is NO `earn_enabled` field on any opportunity. The list endpoints already
 *     return only depositable opportunities; the per-opportunity choice is direct vs
 *     swap, signalled by `swapDirectEnabled` / `swapRouteEnabled`.
 *   - `depositTokens[].chain` is a plain string in the flat /opportunities list but a
 *     rich object in the single + distributor-curated responses. `chainLabel()` handles
 *     both.
 * Other shapes (membership path /v1/membership, verify's metadata.distributorId nesting,
 * deposit's item.transaction nesting) are pinned against the canonical integration guide.
 */

const EARN_API_BASE = "https://earn.turtle.xyz/v1";

export const TURTLE_API_KEY = process.env.NEXT_PUBLIC_TURTLE_API_KEY ?? "";
export const TURTLE_DISTRIBUTOR_ID =
  process.env.NEXT_PUBLIC_TURTLE_DISTRIBUTOR_ID ?? "";

export interface EarnChain {
  id?: string;
  name?: string;
  slug?: string;
  chainId?: string | number;
  logoUrl?: string;
  ecosystem?: string;
  explorerUrl?: string;
}

export interface EarnToken {
  id?: string;
  name?: string;
  symbol: string;
  address: string;
  decimals: number;
  /** String in the flat list; object in single/curated responses. */
  chain?: string | EarnChain;
}

export interface EarnOpportunity {
  id: string;
  name: string;
  description?: string;
  type?: string;
  tvl: number;
  featured?: boolean;
  estimatedApr?: number;
  minDepositAmountUsd?: number;
  swapDirectEnabled?: boolean;
  swapRouteEnabled?: boolean;
  depositTokens: EarnToken[];
  curator?: { name: string; iconUrl?: string };
}

export interface MembershipStatus {
  isMember: boolean;
}

export class TurtleApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "TurtleApiError";
    this.status = status;
    this.body = body;
  }
}

/** Human-readable chain name regardless of which endpoint shape the token came from. */
export function chainLabel(token?: EarnToken): string | undefined {
  if (!token?.chain) return undefined;
  return typeof token.chain === "string" ? token.chain : token.chain.name;
}

/** Numeric chainId for a token, when the chain came back as an object. */
export function chainId(token?: EarnToken): number | undefined {
  if (!token?.chain || typeof token.chain === "string") return undefined;
  const id = token.chain.chainId;
  return id == null ? undefined : Number(id);
}

/** Depositable through the API via at least one mode. (All listed opps qualify today.) */
export function isDepositable(o: EarnOpportunity): boolean {
  return Boolean(o.swapDirectEnabled || o.swapRouteEnabled);
}

async function earnFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!TURTLE_API_KEY) {
    throw new TurtleApiError(
      0,
      "Missing NEXT_PUBLIC_TURTLE_API_KEY — set it in .env",
      null
    );
  }
  const res = await fetch(`${EARN_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TURTLE_API_KEY}`,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `${res.status} ${res.statusText}`;
    throw new TurtleApiError(res.status, message, data);
  }
  return data as T;
}

function unwrapList(data: unknown): EarnOpportunity[] {
  if (Array.isArray(data)) return data as EarnOpportunity[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.opportunities))
      return obj.opportunities as EarnOpportunity[];
    if (Array.isArray(obj.data)) return obj.data as EarnOpportunity[];
  }
  return [];
}

/** Discover: the full catalog. Optional filters mirror the public params. */
export async function getOpportunities(params?: {
  chainIds?: string;
  depositToken?: string;
  tvlGreaterThan?: number;
}): Promise<EarnOpportunity[]> {
  const qs = new URLSearchParams();
  if (params?.chainIds) qs.set("chainIds", params.chainIds);
  if (params?.depositToken) qs.set("depositToken", params.depositToken);
  if (params?.tvlGreaterThan != null) {
    qs.set("tvlGreaterThan", String(params.tvlGreaterThan));
  }
  const query = qs.toString();
  return unwrapList(await earnFetch(`/opportunities${query ? `?${query}` : ""}`));
}

/** Discover: the subset curated under a distributor (defaults to CuratorWatch's). */
export async function getDistributorOpportunities(
  distributorId: string = TURTLE_DISTRIBUTOR_ID
): Promise<EarnOpportunity[]> {
  return unwrapList(
    await earnFetch(`/opportunities/distributors/${distributorId}`)
  );
}

/** Discover: a single opportunity by UUID. */
export async function getOpportunity(id: string): Promise<EarnOpportunity> {
  return earnFetch<EarnOpportunity>(`/opportunities/${id}`);
}

/** Membership: is this wallet already a Turtle member? */
export async function checkMembership(
  address: string
): Promise<MembershipStatus> {
  return earnFetch<MembershipStatus>(
    `/membership?address=${encodeURIComponent(address)}`
  );
}

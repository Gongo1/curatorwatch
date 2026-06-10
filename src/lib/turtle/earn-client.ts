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
  // The single-opportunity endpoint wraps the object in `{ opportunity: {...} }`
  // (the list endpoints don't — see unwrapList). Without unwrapping, every
  // field (swapDirectEnabled, depositTokens…) reads undefined and the deposit
  // panel reports the deal as "not depositable".
  const data = await earnFetch<unknown>(`/opportunities/${id}`);
  if (data && typeof data === "object" && "opportunity" in data) {
    return (data as { opportunity: EarnOpportunity }).opportunity;
  }
  return data as EarnOpportunity;
}

export interface MembershipAgreement {
  message: string;
  nonce: string;
}

/** Membership: is this wallet already a Turtle member? (path has a trailing slash) */
export async function checkMembership(
  address: string
): Promise<MembershipStatus> {
  return earnFetch<MembershipStatus>(
    `/membership/?address=${encodeURIComponent(address)}&walletEcosystem=evm`
  );
}

/** Membership step 1: fetch the SIWE message + nonce for the wallet to sign. */
export async function getMembershipAgreement(
  address: string,
  url: string
): Promise<MembershipAgreement> {
  return earnFetch<MembershipAgreement>(`/membership/agreement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, url, walletEcosystem: "evm" }),
  });
}

/**
 * Membership step 2: submit the signed message to register the wallet.
 * NB: the distributor field here is snake_case `distributor_id` (the deposit endpoint
 * uses camelCase `distributorId` — they differ), and we submit `nonce`, not `message`.
 */
export async function registerMembership(params: {
  address: string;
  nonce: string;
  signature: string;
}): Promise<{ isMember: boolean; error?: string }> {
  return earnFetch(`/membership/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: params.address,
      nonce: params.nonce,
      signature: params.signature,
      walletEcosystem: "evm",
      distributor_id: TURTLE_DISTRIBUTOR_ID,
    }),
  });
}

// ── Deposit ──────────────────────────────────────────────────────────────────

export interface DepositTransaction {
  type?: string;
  description?: string;
  /** Tx data is nested HERE, not flat on the item. item.to is undefined. */
  transaction: {
    to: string;
    data: string;
    value?: string;
    gasLimit?: string;
    chainId?: number;
  };
  metadata?: unknown;
}

export interface DepositQuote {
  actionId?: string;
  transactions: DepositTransaction[];
}

/**
 * Deposit: build the ordered transactions (approval(s) then deposit) for a wallet.
 * `amount` is in the token's smallest unit (use toBaseUnits). The distributor field
 * here is camelCase `distributorId` (membership register uses snake_case).
 */
export async function createDeposit(params: {
  opportunityId: string;
  userAddress: string;
  tokenIn: string;
  amount: string;
  mode?: "direct" | "swap";
  slippageBps?: number;
}): Promise<DepositQuote> {
  const { opportunityId, userAddress, tokenIn, amount, mode, slippageBps } =
    params;
  return earnFetch<DepositQuote>(`/actions/deposit/${opportunityId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userAddress,
      tokenIn,
      amount,
      distributorId: TURTLE_DISTRIBUTOR_ID,
      ...(mode ? { mode } : {}),
      ...(slippageBps != null ? { slippageBps } : {}),
    }),
  });
}

export interface VerifyResult {
  signatureValid: boolean;
  tag?: string;
  error?: string;
  metadata?: {
    distributorId?: string;
    actionId?: string;
    amount?: string;
    amountUsd?: string;
    opportunityId?: string;
    referralCode?: string;
    tokenIn?: string;
    tokenInDecimals?: number;
    action?: string;
  };
}

/** Verify: confirm a deposit tx was attributed. distributorId is under `metadata`. */
export async function verifyDeposit(
  chainIdNum: number,
  txHash: string
): Promise<VerifyResult> {
  return earnFetch<VerifyResult>(
    `/actions/verify?chainId=${chainIdNum}&txHash=${encodeURIComponent(txHash)}`
  );
}

/** Was a verified deposit attributed to CuratorWatch's distributor ID? */
export function isAttributedToUs(v: VerifyResult): boolean {
  return Boolean(
    v.signatureValid && v.metadata?.distributorId === TURTLE_DISTRIBUTOR_ID
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a human decimal amount to the token's smallest unit (no floats). */
export function toBaseUnits(amount: string, decimals: number): string {
  const s = amount.trim();
  if (!s || s.startsWith("-") || !/^\d*\.?\d*$/.test(s)) {
    throw new Error("Enter a valid positive amount");
  }
  const [intPart = "0", fracPart = ""] = s.split(".");
  if (fracPart.length > decimals) {
    throw new Error(`At most ${decimals} decimal places`);
  }
  const base = BigInt((intPart || "0") + fracPart.padEnd(decimals, "0"));
  return base.toString();
}

/** Block-explorer tx URL when the token's chain object carries an explorerUrl. */
export function explorerTxUrl(
  token: EarnToken | undefined,
  hash: string
): string | undefined {
  if (token && typeof token.chain === "object" && token.chain.explorerUrl) {
    return `${token.chain.explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
  }
  return undefined;
}

// ── Track ────────────────────────────────────────────────────────────────────

export interface DepositRecord {
  id?: string;
  txHash: string;
  walletAddress: string;
  chainId?: number;
  opportunityId?: string;
  amountInUsd?: string | null;
  amountToken?: string | null;
  tokenSymbol?: string | null;
  tokenIconUrl?: string | null;
  blockTimestamp?: string | null;
  isSwap?: boolean;
  interaction?: string;
}

export interface DepositsPage {
  deposits: DepositRecord[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
  };
}

/** Track: deposits attributed to CuratorWatch's distributor ID. */
export async function getDistributorDeposits(params?: {
  page?: number;
  limit?: number;
  opportunityId?: string;
}): Promise<DepositsPage> {
  const qs = new URLSearchParams();
  if (params?.page != null) qs.set("page", String(params.page));
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.opportunityId) qs.set("opportunity_id", params.opportunityId);
  const q = qs.toString();
  const data = await earnFetch<DepositsPage | DepositRecord[]>(
    `/deposit/${TURTLE_DISTRIBUTOR_ID}${q ? `?${q}` : ""}`
  );
  if (Array.isArray(data)) return { deposits: data };
  return { deposits: data.deposits ?? [], pagination: data.pagination };
}

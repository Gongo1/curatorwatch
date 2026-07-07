/**
 * Fetch client for the Turtle Earn opportunities feed.
 *
 * Endpoint: https://earn.turtle.xyz/v2/opportunities/ (public, no auth).
 *
 * Migrated v1 → v2 (2026-06). The v1 feed's `estimatedApr` carried a stale,
 * incentive-inflated headline that no longer matched its own itemized incentives
 * (e.g. a stablecoin vault reporting 28% net APY while its only "Lending Yield"
 * incentive was 1.6%), which inflated curator APYs site-wide. v2's `estimatedApr`
 * equals the sum of the current incentives, so reading it fixes the bug at the
 * source. v2 is paginated (envelope `{ data, pagination }`, max 100/page) and uses
 * a flatter token shape (numeric `chainId`, no chain object). This module pages
 * through the full set and normalizes each item back to the internal
 * `TurtleOpportunity` shape, so every downstream consumer is unchanged.
 *
 * NOTE: the authenticated deposit / membership / verify / deal-sync calls still
 * live on v1 (see earn-client.ts, deal-sync.ts) and are intentionally untouched.
 */

import type {
  TurtleOpportunity,
  TurtleToken,
  TurtleIncentive,
  TurtleCurator,
} from "./types";
import { getChainNameById, getChainSlugById } from "./chain-mapper";

const TURTLE_V2_OPPORTUNITIES_URL = "https://earn.turtle.xyz/v2/opportunities/";
const PAGE_SIZE = 100; // v2 hard-caps limit at 100

// ─── Raw v2 response shapes (only the fields we consume) ────────────────────

interface V2Token {
  address: string;
  symbol: string;
  decimals: number;
  chainId: number;
  logoUrl?: string;
}

interface V2Incentive {
  name?: string;
  description?: string;
  rewardType?: string;
  apr?: number | null;
}

interface V2Curator {
  name: string;
  description?: string;
  landingUrl?: string;
  iconUrl?: string;
}

interface V2Opportunity {
  id: string;
  name: string;
  description?: string;
  type: string;
  tvl?: number;
  estimatedApr?: number;
  depositTokens?: V2Token[] | null;
  receiptToken?: V2Token | null;
  incentives?: V2Incentive[] | null;
  curator?: V2Curator | null;
}

interface V2OpportunitiesResponse {
  data: V2Opportunity[];
  pagination?: { page: number; totalPages: number; total: number };
}

// ─── Normalization v2 → internal TurtleOpportunity ──────────────────────────

function toTurtleToken(t: V2Token): TurtleToken {
  return {
    address: t.address,
    symbol: t.symbol,
    decimals: t.decimals,
    // v2 supplies only a numeric chainId; reconstruct the chain object v1 gave us
    // so the chain-mapper (numeric id first, slug as fallback) and the testnet
    // filter (slug-based) keep working unchanged.
    chain: {
      chainId: String(t.chainId),
      slug: getChainSlugById(t.chainId),
      name: getChainNameById(t.chainId),
    },
  };
}

function normalizeOpportunity(o: V2Opportunity): TurtleOpportunity {
  const depositTokens = (o.depositTokens ?? []).map(toTurtleToken);
  const incentives: TurtleIncentive[] = (o.incentives ?? []).map((inc) => ({
    name: inc.name,
    description: inc.description,
    rewardType: inc.rewardType,
    apr: inc.apr ?? 0,
  }));
  const curator: TurtleCurator | undefined = o.curator
    ? {
        name: o.curator.name,
        description: o.curator.description,
        landingUrl: o.curator.landingUrl,
        iconUrl: o.curator.iconUrl,
      }
    : undefined;

  return {
    id: o.id,
    name: o.name,
    description: o.description ?? "",
    type: o.type,
    tvl: o.tvl ?? 0,
    estimatedApr: o.estimatedApr ?? 0,
    depositTokens,
    receiptToken: o.receiptToken ? toTurtleToken(o.receiptToken) : undefined,
    rewardTokens: [], // v2 has no separate rewardTokens; ingestion doesn't use them
    incentives,
    curator,
    // v2 has no top-level chain or protocol. extractProtocol() derives the
    // protocol from name/description (same path v1 used when protocol was absent).
    chain: depositTokens[0]?.chain,
  };
}

/**
 * Fetch every Turtle opportunity by paging through the v2 feed, normalized to the
 * internal `TurtleOpportunity` shape. Signature is unchanged from the v1 client so
 * the ingestion (collect-turtle-data.ts) and other consumers need no edits.
 */
export async function fetchTurtleOpportunities(): Promise<TurtleOpportunity[]> {
  const all: TurtleOpportunity[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = `${TURTLE_V2_OPPORTUNITIES_URL}?page=${page}&limit=${PAGE_SIZE}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });

    if (!response.ok) {
      throw new Error(
        `Turtle API error (page ${page}): ${response.status} ${response.statusText}`
      );
    }

    const body = (await response.json()) as V2OpportunitiesResponse;
    if (!body || !Array.isArray(body.data)) {
      throw new Error(`Unexpected Turtle v2 response format on page ${page}`);
    }

    for (const opp of body.data) all.push(normalizeOpportunity(opp));

    totalPages = body.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return all;
}

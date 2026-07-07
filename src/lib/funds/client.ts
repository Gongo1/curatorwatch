/**
 * Fetch client for the tokenized-funds segment (P3 of the coverage roadmap).
 *
 * Two sources, both unauthenticated:
 *  - Centrifuge public GraphQL (`https://api.centrifuge.io`) — pool-level NAV
 *    for tokenized funds (Janus Henderson/Anemoy JTRSY, JAAA, S&P 500, Apollo
 *    credit). NAV = totalIssuance/10^pool.decimals × tokenPrice/1e18. Working
 *    at POOL level dedups share classes by construction — the per-chain token
 *    instances are the same shares, and the `deRWA` pools are transferable
 *    WRAPPERS of the parent fund's shares (their NAV is already inside the
 *    parent's), so both are never counted separately. TradingStrategy sums all
 *    of them and shows Janus Henderson at "$3.35B"; the real complex is
 *    ~$1.6B, which is what this pipeline reports.
 *  - JSON-RPC `eth_call` on public Ethereum RPCs for funds without an API —
 *    currently JPMorgan's OnChain Liquidity-Token MMF (JLTXX, Kinexys): a $1
 *    constant-NAV money-market fund, so TVL = totalSupply/10^decimals.
 */

const CENTRIFUGE_API = "https://api.centrifuge.io";

// ─── Centrifuge ──────────────────────────────────────────────────────────────

export interface CentrifugeTokenInstance {
  address: string;
  totalIssuance: string;
  blockchain: { id: string } | null;
}

export interface CentrifugeToken {
  symbol: string;
  name: string;
  totalIssuance: string;
  tokenPrice: string;
  tokenInstances: { items: CentrifugeTokenInstance[] };
}

export interface CentrifugePool {
  id: string;
  name: string | null;
  decimals: number;
  isActive: boolean;
  tokens: { items: CentrifugeToken[] };
}

const POOLS_QUERY = `{
  pools(limit: 100) {
    items {
      id
      name
      decimals
      isActive
      tokens {
        items {
          symbol
          name
          totalIssuance
          tokenPrice
          tokenInstances {
            items {
              address
              totalIssuance
              blockchain { id }
            }
          }
        }
      }
    }
  }
}`;

export async function fetchCentrifugePools(): Promise<CentrifugePool[]> {
  const response = await fetch(CENTRIFUGE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: POOLS_QUERY }),
  });
  if (!response.ok) {
    throw new Error(`Centrifuge API error: ${response.status}`);
  }
  const body = (await response.json()) as {
    data?: { pools?: { items: CentrifugePool[] } };
    errors?: unknown[];
  };
  if (!body.data?.pools?.items) {
    throw new Error(`Unexpected Centrifuge response: ${JSON.stringify(body.errors ?? body).slice(0, 200)}`);
  }
  return body.data.pools.items;
}

/** Fund NAV in USD from pool-level issuance and price. */
export function poolTokenNavUsd(pool: CentrifugePool, token: CentrifugeToken): number {
  const issuance = Number(token.totalIssuance) / 10 ** pool.decimals;
  const price = Number(token.tokenPrice) / 1e18;
  if (!Number.isFinite(issuance) || !Number.isFinite(price)) return 0;
  return issuance * price;
}

/** deRWA pools wrap the parent fund's shares — counting them double-counts. */
export function isWrapperPool(pool: CentrifugePool): boolean {
  const text = `${pool.name ?? ""} ${pool.tokens.items.map((t) => `${t.symbol} ${t.name}`).join(" ")}`;
  return /deRWA/i.test(text);
}

// ─── On-chain constant-NAV funds (Kinexys/JLTXX) ─────────────────────────────

/**
 * Funds with no queryable API, read straight from the token contract on
 * public RPCs. `navPerShareUsd` is a structural property of the instrument
 * (constant-NAV money-market fund), not a price guess.
 */
export interface OnchainFundConfig {
  name: string;
  symbol: string;
  address: string;
  chainId: number;
  curatorName: string; // resolved via matchCurator (existing row or clean tc: slug)
  protocol: string;
  navPerShareUsd: number;
  website?: string;
}

export const ONCHAIN_FUNDS: OnchainFundConfig[] = [
  {
    name: "JPMorgan OnChain Liquidity-Token Money Market Fund (JLTXX)",
    symbol: "JLTXX",
    address: "0x09864f52b035ae22ee739dfa5c748fa080d07bd8",
    chainId: 1,
    curatorName: "J.P. Morgan",
    protocol: "kinexys",
    navPerShareUsd: 1,
    website: "https://am.jpmorgan.com",
  },
];

const ETH_RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.llamarpc.com",
  "https://cloudflare-eth.com",
];

async function ethCall(to: string, data: string): Promise<string> {
  let lastError: unknown = null;
  for (const rpc of ETH_RPCS) {
    try {
      const response = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      });
      const body = (await response.json()) as { result?: string; error?: unknown };
      if (body.result && body.result !== "0x") return body.result;
      lastError = body.error ?? "empty result";
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`eth_call failed on all RPCs for ${to}: ${lastError}`);
}

/** Read totalSupply/decimals and return TVL at the configured NAV per share. */
export async function readOnchainFundTvl(fund: OnchainFundConfig): Promise<{
  totalSupply: number;
  decimals: number;
  tvlUsd: number;
}> {
  const [supplyHex, decimalsHex] = await Promise.all([
    ethCall(fund.address, "0x18160ddd"), // totalSupply()
    ethCall(fund.address, "0x313ce567"), // decimals()
  ]);
  const decimals = parseInt(decimalsHex, 16);
  const totalSupply = Number(BigInt(supplyHex)) / 10 ** decimals;
  return { totalSupply, decimals, tvlUsd: totalSupply * fund.navPerShareUsd };
}

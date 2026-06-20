/**
 * Turtle Earn v2 wallet endpoints — public, no auth.
 *
 *   GET /v2/wallet/{address}/portfolio  → cross-protocol DeFi positions
 *   GET /v2/wallets/activity/?addresses= → deposit / withdraw history
 *
 * These power the portfolio dashboard: a wallet's positions are joined to
 * CuratorWatch's curator + risk data in the /api/portfolio route. The portfolio
 * endpoint is a DeBank-style aggregator, so it covers the whole wallet (Aave,
 * Morpho, Spark, Euler, …), not only Turtle-listed opportunities. Each position
 * carries an `opportunity_id` (→ Vault.turtleId) and a `pool.id` (→ Vault.address),
 * the two join keys.
 */

const TURTLE_V2_BASE = "https://earn.turtle.xyz/v2";

// ─── Raw response shapes (only the fields we consume) ───────────────────────

interface RawStats {
  asset_usd_value: string;
  debt_usd_value: string;
  net_usd_value: string;
}

interface RawToken {
  address: string;
  symbol: string;
  amount: string;
  price: string;
  decimals: number;
  chain: string;
  logo_url?: string;
}

interface RawPortfolioItem {
  name?: string;
  type?: string;
  opportunity_id?: string | null;
  pool?: { id?: string; chain?: string } | null;
  stats?: RawStats;
  detail?: {
    supply_token_list?: RawToken[] | null;
    reward_token_list?: RawToken[] | null;
    borrow_token_list?: RawToken[] | null;
  };
}

interface RawProtocol {
  id: string;
  name: string;
  logo_url?: string;
  site_url?: string;
  stats?: RawStats;
  portfolio_item_list?: RawPortfolioItem[] | null;
}

interface RawPortfolioResponse {
  total_stats?: RawStats;
  protocols?: RawProtocol[] | null;
}

interface RawActivityItem {
  id: string;
  interaction: string;
  opportunityId?: string | null;
  amountInUsd?: string | null;
  amountToken?: string | null;
  tokenSymbol?: string | null;
  tokenIconUrl?: string | null;
  txHash: string;
  chainId: number;
  blockTimestamp?: string | null;
  isSwap?: boolean;
}

interface RawActivityResponse {
  activity?: RawActivityItem[] | null;
  pagination?: { page: number; totalPages: number; total: number; hasNext: boolean };
}

// ─── Normalized shapes returned to callers ──────────────────────────────────

export interface PortfolioToken {
  symbol: string;
  address: string;
  amount: number;
  usdValue: number;
  logoUrl?: string;
}

export interface PortfolioPosition {
  protocolId: string;
  protocolName: string;
  protocolLogoUrl?: string;
  name: string;
  type: string;
  /** Turtle opportunity id — joins to Vault.turtleId. */
  opportunityId: string | null;
  /** Vault/market contract address from `pool.id` — joins to Vault.address. */
  poolAddress: string | null;
  chainId: number | null;
  netUsd: number;
  supplyTokens: PortfolioToken[];
  rewardTokens: PortfolioToken[];
}

export interface WalletPortfolio {
  totalNetUsd: number;
  totalAssetUsd: number;
  totalDebtUsd: number;
  positions: PortfolioPosition[];
}

export interface WalletActivityItem {
  id: string;
  interaction: string;
  opportunityId: string | null;
  amountUsd: number | null;
  tokenSymbol: string | null;
  tokenIconUrl: string | null;
  txHash: string;
  chainId: number;
  timestamp: string | null;
}

export interface WalletActivity {
  items: WalletActivityItem[];
  page: number;
  totalPages: number;
  total: number;
  hasNext: boolean;
}

const num = (s: string | null | undefined): number => {
  const n = s != null ? Number(s) : NaN;
  return Number.isFinite(n) ? n : 0;
};

const toChainId = (s: string | undefined | null): number | null => {
  const n = s != null ? Number(s) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

function mapTokens(list: RawToken[] | null | undefined): PortfolioToken[] {
  return (list ?? []).map((t) => ({
    symbol: t.symbol,
    address: t.address,
    amount: num(t.amount),
    usdValue: num(t.amount) * num(t.price),
    logoUrl: t.logo_url,
  }));
}

export async function getWalletPortfolio(address: string): Promise<WalletPortfolio> {
  const res = await fetch(
    `${TURTLE_V2_BASE}/wallet/${address}/portfolio`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    throw new Error(`Turtle portfolio error: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as RawPortfolioResponse;

  const positions: PortfolioPosition[] = [];
  for (const proto of body.protocols ?? []) {
    for (const item of proto.portfolio_item_list ?? []) {
      positions.push({
        protocolId: proto.id,
        protocolName: proto.name,
        protocolLogoUrl: proto.logo_url,
        name: item.name?.trim() || proto.name,
        type: item.type ?? "",
        opportunityId: item.opportunity_id ?? null,
        poolAddress: item.pool?.id ?? null,
        chainId: toChainId(item.pool?.chain),
        netUsd: num(item.stats?.net_usd_value),
        supplyTokens: mapTokens(item.detail?.supply_token_list),
        rewardTokens: mapTokens(item.detail?.reward_token_list),
      });
    }
  }

  return {
    totalNetUsd: num(body.total_stats?.net_usd_value),
    totalAssetUsd: num(body.total_stats?.asset_usd_value),
    totalDebtUsd: num(body.total_stats?.debt_usd_value),
    positions,
  };
}

export async function getWalletActivity(
  address: string,
  opts: { page?: number; limit?: number } = {}
): Promise<WalletActivity> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 10;
  const res = await fetch(
    `${TURTLE_V2_BASE}/wallets/activity/?addresses=${address}&page=${page}&limit=${limit}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    throw new Error(`Turtle activity error: ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as RawActivityResponse;

  return {
    items: (body.activity ?? []).map((a) => ({
      id: a.id,
      interaction: a.interaction,
      opportunityId: a.opportunityId ?? null,
      amountUsd: a.amountInUsd != null ? num(a.amountInUsd) : null,
      tokenSymbol: a.tokenSymbol ?? null,
      tokenIconUrl: a.tokenIconUrl ?? null,
      txHash: a.txHash,
      chainId: a.chainId,
      timestamp: a.blockTimestamp ?? null,
    })),
    page: body.pagination?.page ?? page,
    totalPages: body.pagination?.totalPages ?? 1,
    total: body.pagination?.total ?? 0,
    hasNext: body.pagination?.hasNext ?? false,
  };
}

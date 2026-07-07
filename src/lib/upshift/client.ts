/**
 * Fetch client for Upshift platform vaults (P4 of the coverage roadmap).
 *
 * Upshift (August Digital's institutional-yield platform) has no public JSON
 * API surface we could find — its FastAPI backend rejects unauthenticated
 * paths — but the app at app.upshift.finance SERVER-RENDERS the complete
 * vault list into the page's `__NEXT_DATA__` react-query dehydrated state
 * (query key ["vaults"]): per-vault address, chainId, TVL (USD), APY, fees,
 * receipt token, and `strategists` — the curator attribution (RockawayX,
 * Clearstar, Sentora, K3, …).
 *
 * This is a scrape of an SSR payload, which is inherently more fragile than
 * an API: the parser THROWS loudly on any shape change (the cron isolates
 * the failure), and verifying a value against the Turtle feed showed exact
 * agreement (Upshift USDC $7.71M in both).
 */

const UPSHIFT_APP_URL = "https://app.upshift.finance/";

export interface UpshiftStrategist {
  name: string;
  website_url?: string | null;
}

export interface UpshiftVault {
  chainId: number;
  address: string;
  name: string;
  description?: string;
  status: string; // "active" | ...
  isVisible: boolean;
  startDatetime?: string | null;
  latest_reported_tvl?: number | null; // USD
  totalAssets?: { normalized?: string; raw?: string } | null;
  apy?: { apy?: number | null } | null; // percent
  fees?: { performance?: number | null; management?: number | null } | null; // percent
  receipt?: { symbol?: string; address?: string; decimals?: number } | null;
  strategists?: UpshiftStrategist[] | null;
}

export async function fetchUpshiftVaults(): Promise<UpshiftVault[]> {
  const response = await fetch(UPSHIFT_APP_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0 (compatible; CuratorWatch/1.0)",
    },
  });
  if (!response.ok) {
    throw new Error(`Upshift app fetch failed: ${response.status}`);
  }
  const html = await response.text();

  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s
  );
  if (!match) {
    throw new Error("Upshift app: __NEXT_DATA__ payload not found (page shape changed)");
  }

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new Error("Upshift app: __NEXT_DATA__ is not valid JSON");
  }

  const queries = (data as {
    props?: { pageProps?: { dehydratedState?: { queries?: Array<{ queryKey?: unknown; state?: { data?: unknown } }> } } };
  }).props?.pageProps?.dehydratedState?.queries;
  if (!Array.isArray(queries)) {
    throw new Error("Upshift app: dehydratedState.queries missing (payload shape changed)");
  }

  const vaultsQuery = queries.find(
    (q) => Array.isArray(q.queryKey) && (q.queryKey as unknown[])[0] === "vaults"
  );
  const vaults = vaultsQuery?.state?.data;
  if (!Array.isArray(vaults) || vaults.length === 0) {
    throw new Error("Upshift app: vaults query not found or empty (payload shape changed)");
  }

  return vaults as UpshiftVault[];
}

/** EVM address check — the platform also lists Stellar/other-VM vaults. */
export function isEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

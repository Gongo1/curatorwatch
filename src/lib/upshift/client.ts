/**
 * Fetch client for Upshift platform vaults (P4 of the coverage roadmap).
 *
 * Upshift (August Digital's institutional-yield platform) moved its app to the
 * Next.js App Router in 2026-09, which removed the `__NEXT_DATA__` payload we
 * used to scrape. The app now loads its vault list client-side from its own
 * JSON route `app.upshift.finance/api/proxy/pools`: the vaults the app lists
 * publicly (hidden/wound-down vaults are not returned), with address, chainId,
 * USD TVL, APY (percent), share price, total supply and the STRATEGIST name —
 * the curator attribution (RockawayX, Clearstar, Sentora, K3, …).
 *
 * This is the app's own backend route, not a documented public API: the
 * parser THROWS loudly on any shape change so the cron fails (HTTP 500)
 * instead of silently writing nothing. It carries no fee data.
 */

const UPSHIFT_POOLS_URL = "https://app.upshift.finance/api/proxy/pools";

export interface UpshiftAsset {
  address: string;
  symbol: string;
  decimals: number;
}

export interface UpshiftVault {
  chainId: number; // negative for non-EVM chains (Stellar, Solana)
  address: string;
  name: string;
  status: string; // "active" | ...
  tvl?: number | null; // deposit-asset units
  tvlUsd: number;
  totalSupplyRaw?: string | null;
  sharePrice?: number | null;
  apy?: number | null; // percent
  apyDisplay?: { isTargetOnly?: boolean } | null; // true => `apy` is a target, not realized
  receiptSymbol?: string | null;
  depositAsset?: UpshiftAsset | null;
  strategistName?: string | null;
}

export async function fetchUpshiftVaults(): Promise<UpshiftVault[]> {
  const response = await fetch(UPSHIFT_POOLS_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; CuratorWatch/1.0)",
    },
  });
  if (!response.ok) {
    throw new Error(`Upshift pools fetch failed: ${response.status}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Upshift pools: response is not valid JSON (endpoint changed)");
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Upshift pools: expected a non-empty array (payload shape changed)");
  }

  for (const v of data as Record<string, unknown>[]) {
    if (
      typeof v?.address !== "string" ||
      typeof v.chainId !== "number" ||
      typeof v.name !== "string" ||
      typeof v.status !== "string" ||
      typeof v.tvlUsd !== "number"
    ) {
      throw new Error(
        `Upshift pools: entry missing address/chainId/name/status/tvlUsd (payload shape changed): ${JSON.stringify(v).slice(0, 200)}`
      );
    }
  }

  return data as UpshiftVault[];
}

/** EVM address check — the platform also lists Stellar/other-VM vaults. */
export function isEvmAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

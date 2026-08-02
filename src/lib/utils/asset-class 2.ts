/**
 * Canonical stablecoin / asset-class classifier — the single source of truth for
 * "is this asset a stablecoin".
 *
 * Mirrors the stablecoin-landscape research definition: a symbol is a stablecoin
 * if it contains "USD" (USDC, USDT, USDS, PYUSD, RLUSD, sUSDS, savUSD, …) OR is one
 * of an explicit set whose ticker has no "USD" substring (DAI, EUR/GBP fiat stables,
 * a few DeFi-native dollars). ETH/BTC liquid-staking tokens and gold (XAUt) are
 * intentionally excluded.
 *
 * Previously "stablecoin" was defined ad hoc in ≥5 places — most notably a
 * home-page `!/eth|btc/i` denylist that miscounted gold and every non-ETH/BTC token
 * as stable. Prefer this module everywhere.
 */

// Stablecoins whose ticker does NOT contain the "USD" substring (kept explicit).
const EXPLICIT_STABLES = new Set<string>([
  "DAI", "SDAI",
  "EURC", "EURCV", "EURE", "EURS", "AGEUR", "CEUR", "EURA", // EUR fiat stables
  "TGBP", "GBPT", // GBP fiat stables
  "BOLD", "SBOLD", // Liquity v2
  "USR", // Resolv
  "GHO", "FRAX", // DeFi-native dollars without a "USD" substring
]);

// Symbols that contain "USD" (or otherwise look stable) but are NOT fiat
// stablecoins. Empty today; the hook exists for future false positives.
const STABLE_DENYLIST = new Set<string>([]);

export type AssetClass = "stable" | "eth" | "btc" | "gold" | "other";

function norm(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** True when the asset symbol denotes a fiat stablecoin (USD or EUR/GBP). */
export function isStablecoin(symbol: string | null | undefined): boolean {
  if (!symbol) return false;
  const s = norm(symbol);
  if (STABLE_DENYLIST.has(s)) return false;
  if (s.includes("USD")) return true;
  return EXPLICIT_STABLES.has(s);
}

/** Coarse asset class for taxonomy/grouping. Stable wins over ETH/BTC substrings. */
export function assetClass(symbol: string | null | undefined): AssetClass {
  if (!symbol) return "other";
  const s = norm(symbol);
  if (isStablecoin(s)) return "stable";
  if (s.includes("XAU") || s === "PAXG") return "gold";
  if (s.includes("BTC")) return "btc";
  if (s.includes("ETH")) return "eth";
  return "other";
}

/**
 * Stablecoin share of a set of {symbol, amountUsd} positions, 0–100.
 * Used for the directory's "stablecoin focus" filter and the asset-mix hero.
 */
export function stablecoinSharePct(
  positions: { symbol: string; amountUsd: number }[]
): number {
  let total = 0;
  let stable = 0;
  for (const p of positions) {
    total += p.amountUsd;
    if (isStablecoin(p.symbol)) stable += p.amountUsd;
  }
  return total > 0 ? (stable / total) * 100 : 0;
}

/**
 * Double-count rules: which vault rows re-count TVL that another row already
 * carries. Matched rows stay visible but get countInTotals=false with a reason.
 *
 * MAINTAINED CONFIG — add a line when a new wrapper / bridged copy / nested
 * deposit shows up. Symbols match the receipt token (Vault.onchainSymbol,
 * falling back to Vault.symbol), case-sensitive.
 *
 * Pure: classifyExclusions() decides; applyExclusionRules() (maintenance.ts)
 * writes the result after every collector run.
 */

import type { ExcludeReason } from "./counting";

/** Wrappers of a token another row already counts (all chains). */
export const WRAPPER_SYMBOLS: Record<string, string> = {
  weETH: "wraps eETH (Ether.fi eETH is counted); L2 weETH is the same token bridged",
  wrsETH: "wraps rsETH (Kelp rsETH is counted)",
};

/** Tokens counted on their home chain; copies on any other chain are bridged. */
export const BRIDGED_HOME_CHAIN: Record<string, number> = {
  sUSDS: 1, // Sky Savings USDS
  sUSDe: 1, // Ethena Staked USDe
  sUSDai: 42161, // USD.ai, native on Arbitrum
  rsETH: 1, // Kelp rsETH
};

/** Deposits of a token that is itself counted elsewhere (lending-market receipts). */
export const NESTED_SYMBOLS: Record<string, string> = {
  spweETH: "SparkLend weETH deposits (the weETH is Ether.fi TVL)",
  spwstETH: "SparkLend wstETH deposits (the wstETH is Lido TVL)",
};

/** Auto-rule prefixes: same curator holds both `<p>X` and `X` -> `<p>X` wraps `X`. */
const AUTO_WRAPPER_PREFIXES = ["w", "s"];

/** Identity sources that outrank a Turtle row for the same on-chain vault. */
const NATIVE_SOURCES = new Set(["morpho", "euler", "upshift", "fund", "hyperliquid"]);

export interface ExclusionRow {
  id: string;
  dataSource: string;
  chainId: number;
  curatorId: string | null;
  active: boolean;
  listed: boolean;
  address: string;
  onchainAddress: string | null;
  onchainSymbol: string | null;
  symbol: string;
  lastSnapshotAt: Date | null;
}

/** Rule-managed reasons, in priority order ('phantom' is set by collectors). */
export type RuleReason = Exclude<ExcludeReason, "phantom">;

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

function receiptSymbol(r: ExclusionRow): string {
  return r.onchainSymbol ?? r.symbol;
}

/**
 * Decide the rule-managed exclude reason for every row (null = counted).
 * `freshCutoff`: a native row only suppresses its Turtle twin while the
 * native row itself is fresh, so a dead native feed never zeroes both.
 */
export function classifyExclusions(
  rows: ExclusionRow[],
  freshCutoff: Date
): Map<string, RuleReason | null> {
  // On-chain identities owned by a fresh, active native-pipeline row.
  const nativeKeys = new Set<string>();
  const fundAddresses = new Set<string>();
  for (const r of rows) {
    if (!r.active || !NATIVE_SOURCES.has(r.dataSource)) continue;
    if (!r.lastSnapshotAt || r.lastSnapshotAt < freshCutoff) continue;
    for (const a of [r.address.toLowerCase(), r.onchainAddress]) {
      if (!a) continue;
      nativeKeys.add(`${a}:${r.chainId}`);
      // Tokenized funds reuse one share-token address across chains.
      if (r.dataSource === "fund") fundAddresses.add(a);
    }
  }

  // Receipt symbols each curator holds on active, listed rows (auto-rule base).
  const curatorSymbols = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.active || !r.listed || !r.curatorId) continue;
    const set = curatorSymbols.get(r.curatorId) ?? new Set<string>();
    set.add(receiptSymbol(r));
    curatorSymbols.set(r.curatorId, set);
  }

  const out = new Map<string, RuleReason | null>();
  for (const r of rows) {
    const sym = receiptSymbol(r);
    let reason: RuleReason | null = null;

    if (
      r.dataSource === "turtle" &&
      r.onchainAddress &&
      (nativeKeys.has(`${r.onchainAddress}:${r.chainId}`) || fundAddresses.has(r.onchainAddress))
    ) {
      reason = "cross_source_dup";
    } else if (has(WRAPPER_SYMBOLS, sym)) {
      reason = "wrapper";
    } else if (
      r.curatorId &&
      AUTO_WRAPPER_PREFIXES.some(
        (p) =>
          sym.length > p.length + 1 &&
          sym.startsWith(p) &&
          curatorSymbols.get(r.curatorId!)?.has(sym.slice(p.length))
      )
    ) {
      reason = "wrapper";
    } else if (has(BRIDGED_HOME_CHAIN, sym) && BRIDGED_HOME_CHAIN[sym] !== r.chainId) {
      reason = "bridged";
    } else if (has(NESTED_SYMBOLS, sym)) {
      reason = "nested";
    } else if (!r.listed) {
      reason = "unlisted";
    }

    out.set(r.id, reason);
  }
  return out;
}

/**
 * Fetch client for Hyperliquid Hypercore vaults (P5 of the coverage roadmap).
 *
 * Source: `https://stats-data.hyperliquid.xyz/Mainnet/vaults` — the public
 * dataset behind app.hyperliquid.xyz/vaults (all ~9.5k Hypercore vaults with
 * summary + APR).
 *
 * CuratorWatch ingests ONLY the flagship HLP (Hyperliquidity Provider): of
 * $380M total Hypercore vault TVL, HLP is ~$260M, its own sub-vaults
 * (Liquidator, Strategy A/B — detectable by leader == HLP's address) hold HLP's
 * OWN capital and would double-count, and the remainder is a pseudonymous
 * copy-trading tail (grid bots at 200–1100% APR) with no curator identity —
 * exactly what a curator-first directory keeps out. The ≥$5M tail is returned
 * for reporting so the exclusion is visible, never silent.
 */

const HL_VAULTS_URL = "https://stats-data.hyperliquid.xyz/Mainnet/vaults";

export const HLP_VAULT_ADDRESS = "0xdfc24b077bc1425ad1dea75bcb6f8158e10df303";

interface HlVaultSummary {
  name: string;
  vaultAddress: string;
  leader: string;
  tvl: string;
  isClosed: boolean;
  createTimeMillis?: number;
}

interface HlVaultEntry {
  apr: number;
  summary: HlVaultSummary;
}

export interface HlpSnapshot {
  name: string;
  vaultAddress: string;
  tvlUsd: number;
  aprPct: number; // percent
  createTimeMillis?: number;
  /** HLP sub-vaults (leader == HLP) — capital contained in HLP, never rows */
  children: { name: string; tvlUsd: number }[];
  /** ≥$5M non-HLP tail, reported but not ingested */
  notableSkipped: { name: string; tvlUsd: number; aprPct: number }[];
}

export async function fetchHlp(): Promise<HlpSnapshot> {
  const response = await fetch(HL_VAULTS_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Hyperliquid stats API error: ${response.status}`);
  }
  const entries = (await response.json()) as HlVaultEntry[];
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("Hyperliquid stats API: unexpected/empty payload");
  }

  const open = entries.filter((e) => e.summary && !e.summary.isClosed);
  const hlp = open.find(
    (e) => e.summary.vaultAddress.toLowerCase() === HLP_VAULT_ADDRESS
  );
  if (!hlp) {
    throw new Error("Hyperliquid stats API: HLP vault not found in payload");
  }

  const children = open
    .filter((e) => e.summary.leader.toLowerCase() === HLP_VAULT_ADDRESS)
    .map((e) => ({ name: e.summary.name, tvlUsd: Number(e.summary.tvl) || 0 }));

  const notableSkipped = open
    .filter(
      (e) =>
        e.summary.vaultAddress.toLowerCase() !== HLP_VAULT_ADDRESS &&
        e.summary.leader.toLowerCase() !== HLP_VAULT_ADDRESS &&
        (Number(e.summary.tvl) || 0) >= 5_000_000
    )
    .map((e) => ({
      name: e.summary.name,
      tvlUsd: Number(e.summary.tvl) || 0,
      aprPct: (e.apr ?? 0) * 100,
    }))
    .sort((a, b) => b.tvlUsd - a.tvlUsd);

  return {
    name: hlp.summary.name,
    vaultAddress: hlp.summary.vaultAddress,
    tvlUsd: Number(hlp.summary.tvl) || 0,
    aprPct: (hlp.apr ?? 0) * 100,
    createTimeMillis: hlp.summary.createTimeMillis,
    children,
    notableSkipped,
  };
}

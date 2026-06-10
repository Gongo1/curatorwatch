/**
 * Maps Turtle chain slugs to chain IDs and vice versa.
 */

const CHAIN_MAP: Record<string, { id: number; name: string }> = {
  ethereum: { id: 1, name: "Ethereum" },
  base: { id: 8453, name: "Base" },
  arbitrum: { id: 42161, name: "Arbitrum" },
  optimism: { id: 10, name: "Optimism" },
  polygon: { id: 137, name: "Polygon" },
  avalanche: { id: 43114, name: "Avalanche" },
  bsc: { id: 56, name: "BNB Chain" },
  gnosis: { id: 100, name: "Gnosis" },
  linea: { id: 59144, name: "Linea" },
  scroll: { id: 534352, name: "Scroll" },
  zksync: { id: 324, name: "zkSync Era" },
  blast: { id: 81457, name: "Blast" },
  mantle: { id: 5000, name: "Mantle" },
  mode: { id: 34443, name: "Mode" },
  sei: { id: 1329, name: "Sei" },
  sonic: { id: 146, name: "Sonic" },
};

export function getChainId(slug: string): number {
  return CHAIN_MAP[slug.toLowerCase()]?.id ?? 1;
}

export function getChainName(slug: string): string {
  return CHAIN_MAP[slug.toLowerCase()]?.name ?? slug;
}

export function getChainNameById(id: number): string {
  for (const entry of Object.values(CHAIN_MAP)) {
    if (entry.id === id) return entry.name;
  }
  return "Unknown";
}

/**
 * Display-ready chain label from a possibly-missing/slug-cased chainName plus a
 * chainId fallback. Title-cases bare slugs ("monad" → "Monad"), keeps proper
 * names ("BNB Chain"), and resolves a missing name from chainId (so the many
 * Morpho vaults stored without a chainName but on chainId 1 show "Ethereum").
 * Returns null only when the chain is genuinely unknown — never a guess.
 */
export function prettyChainName(
  name: string | null | undefined,
  chainId?: number | null
): string | null {
  const n = name?.trim();
  if (n) return n === n.toLowerCase() ? n.charAt(0).toUpperCase() + n.slice(1) : n;
  if (chainId != null) {
    const byId = getChainNameById(chainId);
    return byId === "Unknown" ? null : byId;
  }
  return null;
}

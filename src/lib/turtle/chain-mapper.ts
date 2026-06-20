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
  // Chains Turtle returns that were previously unmapped — ids verified against the
  // live Turtle feed (earn.turtle.xyz/v1/opportunities, which carries an explicit
  // numeric chainId per chain) and cross-checked against the risk engine's data.
  monad: { id: 143, name: "Monad" },
  plasma: { id: 9745, name: "Plasma" },
  katana: { id: 747474, name: "Katana" },
  unichain: { id: 130, name: "Unichain" },
  berachain: { id: 80094, name: "Berachain" },
  hyperevm: { id: 999, name: "HyperEVM" },
  tac: { id: 239, name: "TAC" },
  ink: { id: 57073, name: "Ink" },
  swell: { id: 1923, name: "Swell" },
  metis: { id: 1088, name: "Metis" },
  pharos: { id: 1672, name: "Pharos" },
  xlayer: { id: 196, name: "X Layer" },
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

/** Known testnet chain ids → slug. The v2 Earn API gives only a numeric chainId
 * per token (no slug), so the slug-based testnet guard in the ingestion needs a
 * reverse lookup to keep working. Kept separate from CHAIN_MAP (mainnets only). */
const TESTNET_CHAIN_IDS: Record<number, string> = {
  11155111: "sepolia",
  5: "goerli",
  17000: "holesky",
  43113: "fuji",
  80001: "mumbai",
};

/**
 * Reverse lookup: numeric chainId → Turtle slug. Returns the mainnet slug from
 * CHAIN_MAP, a known testnet slug, or "" when unknown. Used by the v2 client to
 * reconstruct the `chain.slug` that v1 supplied directly, so downstream code
 * (testnet filter, canonicalChainName fallback) is unchanged.
 */
export function getChainSlugById(id: number): string {
  for (const [slug, entry] of Object.entries(CHAIN_MAP)) {
    if (entry.id === id) return slug;
  }
  return TESTNET_CHAIN_IDS[id] ?? "";
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

/**
 * Resolve a numeric chainId for an ingested vault. Prefers the source's explicit
 * numeric chainId (Turtle puts one on every chain object), falling back to the
 * slug→id map. Returns null when neither resolves — callers should skip + log the
 * vault rather than silently mislabel it as Ethereum (chainId 1), which was the
 * root cause of ~60 non-Ethereum vaults collapsing onto mainnet.
 */
export function resolveChainId(
  rawChainId: unknown,
  slug?: string | null
): number | null {
  const n = rawChainId != null ? Number(rawChainId) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  const bySlug = slug ? CHAIN_MAP[slug.toLowerCase()]?.id : undefined;
  return bySlug ?? null;
}

/**
 * Canonical, display-ready chain name for storage. Resolves the registry name by
 * chainId; if the id is unknown, Title-cases the slug so we never store a raw
 * lowercase value. Use this at INGESTION so chainName is always canonical
 * (TitleCase) and read sites can group by it without casing dupes.
 */
export function canonicalChainName(chainId: number, fallbackSlug?: string | null): string {
  const byId = getChainNameById(chainId);
  if (byId !== "Unknown") return byId;
  const s = fallbackSlug?.trim();
  if (s) return s === s.toLowerCase() ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  return "Unknown";
}

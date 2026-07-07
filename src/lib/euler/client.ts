/**
 * Fetch client for Euler vault data (P2 of the coverage roadmap).
 *
 * Two public surfaces, both unauthenticated:
 *  - Vault state: `https://app.euler.finance/api/v3/{evk|earn}/vaults` —
 *    paginated (offset/limit, meta.total), per chain. `evk` = EVK lending
 *    vaults (each curated cluster is a set of these), `earn` = EulerEarn
 *    aggregator vaults. TVL arrives as `totalSupplyUsd`; APY as percent.
 *  - Curator attribution: `https://labels.euler.finance/master/{chainId}/`
 *    (the euler-xyz/euler-labels repo, which is what the Euler app itself
 *    uses). `products.json` groups vault addresses under an entity slug;
 *    `entities.json` gives the entity's display name/url.
 *
 * CuratorWatch ingests ONLY labeled (entity-attributed) vaults: EVK vault
 * deployment is permissionless and the unlabeled tail is exactly the junk a
 * curator-first directory must keep out. The `euler-dao` entity is excluded —
 * protocol self-governance is not a curator (same stance as the Turtle
 * protocol denylist).
 */

const EULER_API_BASE = "https://app.euler.finance/api/v3";
const EULER_LABELS_BASE = "https://labels.euler.finance/master";
const PAGE_LIMIT = 100;

/** Chains enabled in the Euler app (window.__CHAIN_CONFIG__.enabledChainIds). */
export const EULER_CHAIN_IDS = [
  1, // Ethereum
  8453, // Base
  146, // Sonic
  9745, // Plasma
  56, // BNB Chain
  43114, // Avalanche
  42161, // Arbitrum
  143, // Monad
  999, // HyperEVM
  130, // Unichain
  59144, // Linea
  80094, // Berachain
  1923, // Swell
  239, // TAC
  60808, // BOB
];

export interface EulerApiVault {
  chainId: number;
  address: string;
  vaultType?: string; // "evk" on the evk endpoint; absent on earn
  name: string;
  symbol: string;
  decimals: number;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
    name?: string;
  } | null;
  totalAssets: string;
  totalSupplyUsd: number | null;
  supplyApy: number | null; // percent (e.g. 11.39 = 11.39%)
  apy7d?: number | null;
  apy30d?: number | null;
  utilization?: number | null;
  createdAt?: string | null; // ISO timestamp
}

interface EulerVaultsResponse {
  data: EulerApiVault[];
  meta?: { total?: number; offset?: number; limit?: number };
}

/**
 * Fetch every vault of one kind on one chain, paging via offset/limit.
 */
export async function fetchEulerVaults(
  chainId: number,
  kind: "evk" | "earn"
): Promise<EulerApiVault[]> {
  const all: EulerApiVault[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${EULER_API_BASE}/${kind}/vaults?chainId=${chainId}&limit=${PAGE_LIMIT}&offset=${offset}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    // Deprecated/SDK-only chains (e.g. Sonic, TAC, BOB) 404 on the v3 API, and
    // some chains have evk but no earn endpoint — treat "not served" as empty
    // rather than failing the chain. Real server errors still throw.
    if (response.status === 404 || response.status === 400) return all;
    if (!response.ok) {
      throw new Error(`Euler API error (${kind} chain ${chainId} offset ${offset}): ${response.status}`);
    }
    const body = (await response.json()) as EulerVaultsResponse;
    if (!body || !Array.isArray(body.data)) {
      throw new Error(`Unexpected Euler ${kind} response shape (chain ${chainId})`);
    }
    all.push(...body.data);
    total = body.meta?.total ?? all.length;
    if (body.data.length === 0) break; // defensive: never loop on an empty page
    offset += body.data.length;
  }

  return all;
}

// ─── Labels (curator attribution) ────────────────────────────────────────────

interface EulerLabelEntity {
  name: string;
  url?: string;
  description?: string;
}

interface EulerLabelProduct {
  name: string;
  entity: string | string[];
  vaults: string[];
  deprecatedVaults?: string[];
  deprecationReason?: string;
  url?: string;
}

export interface EulerAttribution {
  entitySlug: string;
  entityName: string;
  entityUrl?: string;
  productName: string;
}

/** Entity slugs that must never become curators. */
const ENTITY_DENYLIST = new Set(["euler-dao"]);

async function fetchLabelsFile<T>(chainId: number, file: string): Promise<T | null> {
  const response = await fetch(`${EULER_LABELS_BASE}/${chainId}/${file}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null; // chains without labels simply have no attribution
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Build the vault-address → curator-entity map for one chain from the labels
 * repo, plus the set of deprecated vault addresses (e.g. TelosC's frozen
 * Stream-exposure markets — insolvent/stuck positions that must never appear
 * as live TVL). Addresses are lowercased. Vaults in denylisted or unknown
 * entities are omitted (the collector skips unattributed EVK vaults).
 */
export async function fetchEulerAttribution(
  chainId: number
): Promise<{ attribution: Map<string, EulerAttribution>; deprecated: Set<string> }> {
  const [entities, products] = await Promise.all([
    fetchLabelsFile<Record<string, EulerLabelEntity>>(chainId, "entities.json"),
    fetchLabelsFile<Record<string, EulerLabelProduct>>(chainId, "products.json"),
  ]);

  const attribution = new Map<string, EulerAttribution>();
  const deprecated = new Set<string>();
  if (!entities || !products) return { attribution, deprecated };

  for (const product of Object.values(products)) {
    for (const address of product.deprecatedVaults ?? []) {
      deprecated.add(address.toLowerCase());
    }
    const slugs = Array.isArray(product.entity) ? product.entity : [product.entity];
    const slug = slugs[0];
    if (!slug || ENTITY_DENYLIST.has(slug)) continue;
    const entity = entities[slug];
    if (!entity?.name) continue;
    for (const address of product.vaults ?? []) {
      attribution.set(address.toLowerCase(), {
        entitySlug: slug,
        entityName: entity.name,
        entityUrl: entity.url,
        productName: product.name,
      });
    }
  }

  return { attribution, deprecated };
}

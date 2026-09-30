/**
 * Fetch client for Euler vault data (P2 of the coverage roadmap).
 *
 * Two public surfaces, both unauthenticated:
 *  - Vault state: the Euler Data API v3, `https://v3.euler.finance/v3/{evk|earn}/vaults`
 *    (documented at https://v3.euler.finance/v3/docs; anonymous tier
 *    100 req/min per IP, an optional `X-API-Key` raises it). Paginated
 *    (offset/limit, meta.total), per chain. `evk` = EVK lending vaults (each
 *    curated cluster is a set of these), `earn` = EulerEarn aggregator vaults.
 *    TVL arrives as `totalSupplyUsd`; APY as percent.
 *    History: until 2026-07-08 this client read the same payloads through the
 *    app's proxy (`app.euler.finance/api/v3/*`). The app then locked
 *    `/api/internal/*` (403 "not a public contract"), the fetch silently
 *    returned nothing, and Euler froze for 12 weeks — so every failure below
 *    now throws instead of degrading to "no vaults".
 *  - Curator attribution: `https://labels.euler.finance/master/{chainId}/`
 *    (the euler-xyz/euler-labels repo, which is what the Euler app itself
 *    uses). `products.json` groups vault addresses under an entity slug;
 *    `entities.json` gives the entity's display name/url; `earn-vaults.json`
 *    carries EulerEarn deprecations.
 *
 * CuratorWatch ingests ONLY labeled (entity-attributed) vaults: EVK vault
 * deployment is permissionless and the unlabeled tail is exactly the junk a
 * curator-first directory must keep out. The `euler-dao` entity is excluded —
 * protocol self-governance is not a curator (same stance as the Turtle
 * protocol denylist).
 */

const EULER_API_BASE = "https://v3.euler.finance/v3";
const EULER_LABELS_BASE = "https://labels.euler.finance/master";
const PAGE_LIMIT = 100;
// The v3 API hides "hidden" vaults from discovery by default; request them
// too so a curator's wound-down vault is still counted (policy stays ours).
const VISIBILITY = "visible,warning,hidden";
/** Per-request cap for the v3 API and the labels bucket. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Signal for one outbound request: aborts after `ms`, or earlier when the
 * caller's run-level `signal` aborts (the collector's fetch budget). A hung
 * socket can then never hold the cron until Vercel kills it.
 */
export function requestSignal(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/**
 * Chains the v3 Data API serves (verified 2026-09-30). Sonic (146) is read
 * on-chain (see onchain.ts); Berachain, Swell, TAC and BOB answer
 * CHAIN_NOT_SUPPORTED and are not covered. Any error on a listed chain —
 * including a 404 — is a real failure and throws.
 */
export const EULER_CHAIN_IDS = [
  1, // Ethereum
  8453, // Base
  9745, // Plasma
  56, // BNB Chain
  43114, // Avalanche
  42161, // Arbitrum
  143, // Monad
  999, // HyperEVM
  130, // Unichain
  59144, // Linea
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
  visibility?: { status?: string; reason?: string | null } | null;
}

interface EulerVaultsResponse {
  data: EulerApiVault[];
  meta?: { total?: number; offset?: number; limit?: number };
}

/**
 * Fetch every vault of one kind on one chain, paging via offset/limit.
 * Throws on any non-OK response or malformed page — never returns a partial
 * or empty list for a failed call.
 */
export async function fetchEulerVaults(
  chainId: number,
  kind: "evk" | "earn",
  signal?: AbortSignal
): Promise<EulerApiVault[]> {
  const all: EulerApiVault[] = [];
  let offset = 0;
  let total = Infinity;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.EULER_API_KEY) headers["X-API-Key"] = process.env.EULER_API_KEY;

  while (offset < total) {
    const url = `${EULER_API_BASE}/${kind}/vaults?chainId=${chainId}&limit=${PAGE_LIMIT}&offset=${offset}&visibility=${VISIBILITY}`;
    const response = await fetch(url, { headers, signal: requestSignal(signal, REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      throw new Error(`Euler API error (${kind} chain ${chainId} offset ${offset}): ${response.status} ${detail}`);
    }
    const body = (await response.json()) as EulerVaultsResponse;
    if (!body || !Array.isArray(body.data) || typeof body.meta?.total !== "number") {
      throw new Error(`Unexpected Euler ${kind} response shape (chain ${chainId})`);
    }
    all.push(...body.data);
    total = body.meta.total;
    if (body.data.length === 0) break; // defensive: never loop on an empty page
    offset += body.data.length;
  }

  if (all.length < total) {
    throw new Error(`Euler ${kind} chain ${chainId}: paged ${all.length} of ${total} vaults`);
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

type EulerEarnLabel =
  | string
  | { address: string; deprecated?: boolean; deprecationReason?: string };

async function fetchLabelsFile<T>(
  chainId: number,
  file: string,
  signal?: AbortSignal
): Promise<T | null> {
  const response = await fetch(`${EULER_LABELS_BASE}/${chainId}/${file}`, {
    headers: { Accept: "application/json" },
    signal: requestSignal(signal, REQUEST_TIMEOUT_MS),
  });
  // The labels bucket answers 403/404 for a file a chain doesn't have — that
  // chain simply has no attribution. Anything else is an outage: throw, or
  // every vault on the chain would silently fall out as "unlabeled".
  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Euler labels error (${chainId}/${file}): ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Build the vault-address → curator-entity map for one chain from the labels
 * repo, plus the set of deprecated vault addresses (e.g. TelosC's frozen
 * Stream-exposure markets — insolvent/stuck positions that must never appear
 * as live TVL): EVK vaults on a product's deprecatedVaults list and EulerEarn
 * vaults flagged `deprecated` in earn-vaults.json. Addresses are lowercased.
 * Vaults in denylisted or unknown entities are omitted (the collector skips
 * unattributed EVK vaults).
 */
export async function fetchEulerAttribution(
  chainId: number,
  signal?: AbortSignal
): Promise<{ attribution: Map<string, EulerAttribution>; deprecated: Set<string> }> {
  const [entities, products, earnLabels] = await Promise.all([
    fetchLabelsFile<Record<string, EulerLabelEntity>>(chainId, "entities.json", signal),
    fetchLabelsFile<Record<string, EulerLabelProduct>>(chainId, "products.json", signal),
    fetchLabelsFile<EulerEarnLabel[]>(chainId, "earn-vaults.json", signal),
  ]);

  const attribution = new Map<string, EulerAttribution>();
  const deprecated = new Set<string>();

  for (const entry of earnLabels ?? []) {
    if (typeof entry !== "string" && entry.deprecated) {
      deprecated.add(entry.address.toLowerCase());
    }
  }

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

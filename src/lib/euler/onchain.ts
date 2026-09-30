/**
 * On-chain Euler reads for chains the v3 API doesn't serve (task: Sonic).
 *
 * Sonic (chainId 146) is an "SDK-only" chain in Euler's app config — the v3
 * REST API 404s for it — so vault state is read straight from the contracts
 * via public RPCs. The vault list and curator attribution still come from
 * euler-labels (the registry the Euler app itself uses).
 *
 * Deprecation nuance, verified on-chain 2026-07-07: Euler marks all of MEV
 * Capital's Sonic clusters "Deprecated due to low activity", yet ~$26.5M of
 * deposits remain live in them (USDC/scUSD/xUSD, confirmed via totalAssets()
 * — matching TradingStrategy's figures; Apostro's "$48.7M" Sonic vault by
 * contrast reads 0 on-chain). Wound-down-but-funded markets are real curator
 * AUM, so they ingest with `listed: false` — counted, not promoted. Products
 * whose deprecation reason mentions insolvency are excluded entirely (the
 * TelosC/Stream rule).
 *
 * USD pricing: only stablecoin-denominated vaults are valued ($1 × assets);
 * non-stable assets are skipped and reported — no oracle guessing.
 */

import { isStablecoin } from "../utils/asset-class";
import { mapLimit } from "../utils/map-limit";
import { requestSignal } from "./client";

const SONIC_RPCS = ["https://rpc.soniclabs.com", "https://sonic.drpc.org"];
// Per request (each RPC in the fallback list gets its own). Measured
// 2026-09-30: single calls hung for 8s+, and with no timeout a hung socket
// held the run until the platform killed it.
const RPC_TIMEOUT_MS = 8_000;
// Reads go out as JSON-RPC batches to SONIC_RPCS[0]: 72 calls answer in
// 0.3-0.7s, where 146 single calls took 30-39s (the RPC throttles parallel
// requests to ~2.4s each, so concurrency alone does not help). Calls a batch
// did not answer retry one by one over every RPC (drpc's free tier rejects
// batches above 3), this many at a time.
const FALLBACK_CONCURRENCY = 4;

// ERC-4626 / ERC-20 selectors
const SEL_TOTAL_ASSETS = "0x01e1d114";
const SEL_ASSET = "0x38d52e0f";
const SEL_DECIMALS = "0x313ce567";
const SEL_SYMBOL = "0x95d89b41";

async function ethCall(
  rpcs: string[],
  to: string,
  data: string,
  signal?: AbortSignal
): Promise<string> {
  let lastError: unknown = null;
  for (const rpc of rpcs) {
    if (signal?.aborted) break; // run budget spent: no more fallbacks
    try {
      const response = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
        signal: requestSignal(signal, RPC_TIMEOUT_MS),
      });
      const body = (await response.json()) as { result?: string; error?: unknown };
      if (body.result && body.result !== "0x") return body.result;
      lastError = body.error ?? "empty result";
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`eth_call failed for ${to}: ${lastError ?? signal?.reason}`);
}

/**
 * Answer every call, in order: one JSON-RPC batch to the primary RPC, then a
 * per-call retry over every RPC for anything the batch did not answer.
 * null = unreadable on every RPC (same rule as a failed ethCall).
 */
async function ethCalls(
  calls: { to: string; data: string }[],
  signal?: AbortSignal
): Promise<(string | null)[]> {
  const out: (string | null)[] = calls.map(() => null);
  if (calls.length === 0) return out;
  try {
    const response = await fetch(SONIC_RPCS[0], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        calls.map(({ to, data }, id) => ({ jsonrpc: "2.0", id, method: "eth_call", params: [{ to, data }, "latest"] }))
      ),
      signal: requestSignal(signal, RPC_TIMEOUT_MS),
    });
    const body = (await response.json()) as unknown;
    if (Array.isArray(body)) {
      for (const item of body as { id?: unknown; result?: string }[]) {
        if (typeof item?.id === "number" && item.id >= 0 && item.id < calls.length && item.result && item.result !== "0x") {
          out[item.id] = item.result;
        }
      }
    }
  } catch {
    // whole batch failed: every call takes the per-call path below
  }

  const missing = out.flatMap((r, i) => (r === null ? [i] : []));
  await mapLimit(missing, FALLBACK_CONCURRENCY, async (i) => {
    try {
      out[i] = await ethCall(SONIC_RPCS, calls[i].to, calls[i].data, signal);
    } catch {
      // stays null → unreadable
    }
  });
  return out;
}

/** Decode a solidity `string` return (with bytes32-symbol fallback). */
function decodeString(hex: string): string {
  const h = hex.replace(/^0x/, "");
  try {
    if (h.length > 128) {
      const len = parseInt(h.slice(64, 128), 16);
      return Buffer.from(h.slice(128, 128 + len * 2), "hex").toString("utf8").replace(/\0/g, "");
    }
    return Buffer.from(h, "hex").toString("utf8").replace(/\0/g, "").trim();
  } catch {
    return "";
  }
}

export interface SonicEulerVault {
  address: string;
  chainId: 146;
  name: string; // product name + asset symbol
  assetAddress: string;
  assetSymbol: string;
  assetDecimals: number;
  tvlUsd: number;
  listed: boolean; // false for wound-down (non-insolvency deprecated) markets
  entityName: string;
  entityUrl?: string;
  productName: string;
}

interface LabelProduct {
  name: string;
  entity: string | string[];
  vaults?: string[];
  deprecatedVaults?: string[];
  deprecationReason?: string;
  url?: string;
}

export interface SonicFetchResult {
  vaults: SonicEulerVault[];
  skippedNonStable: { symbol: string; assets: number }[];
  skippedInsolvency: number;
  skippedEmpty: number;
  unreadable: number; // eth_call failed on every RPC
}

/**
 * @param signal run-level budget: when it aborts, pending reads fail fast and
 *   count as unreadable (so the Sonic stale sweep is skipped for this run).
 */
export async function fetchSonicEulerVaults(signal?: AbortSignal): Promise<SonicFetchResult> {
  // The labels are the vault list here — an unreadable file must fail the
  // run, not read as "Sonic has no vaults".
  const [products, entities] = await Promise.all(
    ["products.json", "entities.json"].map(async (file) => {
      const r = await fetch(`https://labels.euler.finance/master/146/${file}`, {
        signal: requestSignal(signal, RPC_TIMEOUT_MS),
      });
      if (!r.ok) throw new Error(`Euler labels error (146/${file}): ${r.status}`);
      return r.json();
    })
  );

  const skippedNonStable: SonicFetchResult["skippedNonStable"] = [];
  let skippedInsolvency = 0;
  let skippedEmpty = 0;
  let unreadable = 0;

  // Every vault to read, in label order (the result keeps this order).
  const reads: {
    address: string;
    listed: boolean;
    product: LabelProduct;
    entity: { name: string; url?: string };
  }[] = [];
  for (const product of Object.values(products as Record<string, LabelProduct>)) {
    const slug = Array.isArray(product.entity) ? product.entity[0] : product.entity;
    const entity = (entities as Record<string, { name?: string; url?: string }>)[slug];
    if (!entity?.name) continue;

    const insolvency = /insolven/i.test(product.deprecationReason ?? "");
    const candidates: { address: string; listed: boolean }[] = [
      ...(product.vaults ?? []).map((address) => ({ address, listed: true })),
      ...(insolvency
        ? []
        : (product.deprecatedVaults ?? []).map((address) => ({ address, listed: false }))),
    ];
    if (insolvency) skippedInsolvency += (product.deprecatedVaults ?? []).length;
    for (const c of candidates) {
      reads.push({ ...c, product, entity: { name: entity.name, url: entity.url } });
    }
  }
  const attempted = reads.length;

  // Round 1: totalAssets() + asset() of every vault. Round 2: decimals() +
  // symbol() of each distinct asset token (vaults share a handful).
  const vaultRes = await ethCalls(
    reads.flatMap(({ address }) => [
      { to: address, data: SEL_TOTAL_ASSETS },
      { to: address, data: SEL_ASSET },
    ]),
    signal
  );
  const assetOf = reads.map((_, i) => {
    const assetHex = vaultRes[2 * i + 1];
    return vaultRes[2 * i] !== null && assetHex !== null ? "0x" + assetHex.slice(-40) : null;
  });
  const assets = [...new Set(assetOf.filter((a): a is string => a !== null))];
  const assetRes = await ethCalls(
    assets.flatMap((to) => [
      { to, data: SEL_DECIMALS },
      { to, data: SEL_SYMBOL },
    ]),
    signal
  );
  const assetMeta = new Map(assets.map((a, j) => [a, { decHex: assetRes[2 * j], symHex: assetRes[2 * j + 1] }]));

  const results = reads.map(({ address, listed, product, entity }, i) => {
    const taHex = vaultRes[2 * i];
    const assetAddress = assetOf[i];
    const meta = assetAddress ? assetMeta.get(assetAddress) : undefined;
    if (taHex === null || !assetAddress || !meta || meta.decHex === null || meta.symHex === null) {
      unreadable++; // most deprecated shells are empty; an RPC outage fails them all
      return null;
    }
    try {
      const assetDecimals = parseInt(meta.decHex, 16);
      const assetSymbol = decodeString(meta.symHex) || "UNKNOWN";
      const assets = Number(BigInt(taHex)) / 10 ** assetDecimals;

      if (!Number.isFinite(assets) || assets <= 0) {
        skippedEmpty++;
        return null;
      }
      if (!isStablecoin(assetSymbol)) {
        skippedNonStable.push({ symbol: assetSymbol, assets });
        return null;
      }

      const vault: SonicEulerVault = {
        address,
        chainId: 146,
        name: `${product.name} — ${assetSymbol}`,
        assetAddress,
        assetSymbol,
        assetDecimals,
        tvlUsd: assets, // $1 per stable unit
        listed,
        entityName: entity.name,
        entityUrl: entity.url,
        productName: product.name,
      };
      return vault;
    } catch {
      unreadable++; // undecodable return data (e.g. BigInt of a malformed hex)
      return null;
    }
  });
  const vaults = results.filter((v): v is SonicEulerVault => v !== null);

  if (attempted > 0 && unreadable === attempted) {
    throw new Error(`Sonic on-chain: all ${attempted} vault reads failed (RPC outage?)`);
  }
  return { vaults, skippedNonStable, skippedInsolvency, skippedEmpty, unreadable };
}

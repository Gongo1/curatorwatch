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

const SONIC_RPCS = ["https://rpc.soniclabs.com", "https://sonic.drpc.org"];

// ERC-4626 / ERC-20 selectors
const SEL_TOTAL_ASSETS = "0x01e1d114";
const SEL_ASSET = "0x38d52e0f";
const SEL_DECIMALS = "0x313ce567";
const SEL_SYMBOL = "0x95d89b41";

async function ethCall(rpcs: string[], to: string, data: string): Promise<string> {
  let lastError: unknown = null;
  for (const rpc of rpcs) {
    try {
      const response = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      });
      const body = (await response.json()) as { result?: string; error?: unknown };
      if (body.result && body.result !== "0x") return body.result;
      lastError = body.error ?? "empty result";
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`eth_call failed for ${to}: ${lastError}`);
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

export async function fetchSonicEulerVaults(): Promise<SonicFetchResult> {
  // The labels are the vault list here — an unreadable file must fail the
  // run, not read as "Sonic has no vaults".
  const [products, entities] = await Promise.all(
    ["products.json", "entities.json"].map(async (file) => {
      const r = await fetch(`https://labels.euler.finance/master/146/${file}`);
      if (!r.ok) throw new Error(`Euler labels error (146/${file}): ${r.status}`);
      return r.json();
    })
  );

  const vaults: SonicEulerVault[] = [];
  const skippedNonStable: SonicFetchResult["skippedNonStable"] = [];
  let skippedInsolvency = 0;
  let skippedEmpty = 0;
  let unreadable = 0;
  let attempted = 0;

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

    for (const { address, listed } of candidates) {
      attempted++;
      try {
        const [taHex, assetHex] = await Promise.all([
          ethCall(SONIC_RPCS, address, SEL_TOTAL_ASSETS),
          ethCall(SONIC_RPCS, address, SEL_ASSET),
        ]);
        const assetAddress = "0x" + assetHex.slice(-40);
        const [decHex, symHex] = await Promise.all([
          ethCall(SONIC_RPCS, assetAddress, SEL_DECIMALS),
          ethCall(SONIC_RPCS, assetAddress, SEL_SYMBOL),
        ]);
        const assetDecimals = parseInt(decHex, 16);
        const assetSymbol = decodeString(symHex) || "UNKNOWN";
        const assets = Number(BigInt(taHex)) / 10 ** assetDecimals;

        if (!Number.isFinite(assets) || assets <= 0) {
          skippedEmpty++;
          continue;
        }
        if (!isStablecoin(assetSymbol)) {
          skippedNonStable.push({ symbol: assetSymbol, assets });
          continue;
        }

        vaults.push({
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
        });
      } catch {
        unreadable++; // most deprecated shells are empty; an RPC outage fails them all
      }
    }
  }

  if (attempted > 0 && unreadable === attempted) {
    throw new Error(`Sonic on-chain: all ${attempted} vault reads failed (RPC outage?)`);
  }
  return { vaults, skippedNonStable, skippedInsolvency, skippedEmpty, unreadable };
}

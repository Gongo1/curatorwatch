import { prisma } from "../lib/db";
import type { Prisma } from "@prisma/client";
import { morphoClient } from "../lib/graphql/client";
import { gql } from "graphql-request";

const API_DELAY_MS = 100;
// Vaults per vaultV2s request. The Morpho API caps query complexity at 1M and
// each vault with its caps costs ~20k, so 40 per request stays near 800k.
const VAULTS_PER_REQUEST = 40;
// Per-request timeout; one retry. A hung request must not hold the function.
const REQUEST_TIMEOUT_MS = 30_000;
// Stop issuing requests after this long and report the rest as errors, so the
// step stays bounded inside the collect-market-data cap even if the API is slow.
const TIME_BUDGET_MS = 300_000;
const WRITE_CHUNK = 500;

function log(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [market-alloc] ${message}`);
}

function logError(message: string, error?: unknown) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [market-alloc] ERROR: ${message}`, error ?? "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Batched: one request per chain per VAULTS_PER_REQUEST addresses. V1
// (MetaMorpho) addresses simply do not match, instead of one NOT_FOUND error
// per vault as with vaultV2ByAddress.
const GET_VAULTS_MARKET_CAPS = gql`
  query GetVaultsMarketCaps($chainId: Int!, $addresses: [String!]!, $first: Int!) {
    vaultV2s(first: $first, where: { chainId_in: [$chainId], address_in: $addresses }) {
      items {
        address
        totalAssets
        totalAssetsUsd
        caps {
          items {
            type
            allocation
            data {
              ... on MarketV1CapData {
                adapterAddress
                market {
                  marketId
                  loanAsset { symbol address }
                  collateralAsset { symbol address }
                  lltv
                  oracle { address type }
                  state {
                    supplyAssetsUsd
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface MarketCapItem {
  type: string;
  allocation: string;
  data: {
    adapterAddress?: string;
    market?: {
      marketId: string;
      loanAsset: { symbol: string; address: string };
      collateralAsset: { symbol: string; address: string } | null;
      lltv: string;
      oracle: { address: string; type: string | null } | null;
      state: { supplyAssetsUsd: number } | null;
    };
  };
}

interface VaultV2MarketCaps {
  address: string;
  totalAssets: string;
  totalAssetsUsd: number;
  caps: {
    items: MarketCapItem[];
  };
}

interface VaultsMarketCapsResponse {
  vaultV2s: { items: VaultV2MarketCaps[] };
}

async function fetchVaultsMarketCaps(
  chainId: number,
  addresses: string[]
): Promise<VaultV2MarketCaps[]> {
  const request = () =>
    morphoClient.request<VaultsMarketCapsResponse>({
      document: GET_VAULTS_MARKET_CAPS,
      variables: { chainId, addresses, first: addresses.length },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  try {
    return (await request()).vaultV2s.items;
  } catch {
    await sleep(1000);
    return (await request()).vaultV2s.items;
  }
}

/**
 * Snapshot every active Morpho vault's MarketV1 caps into MarketAllocation.
 *
 * ~20 batched API requests (not one per vault) and one createMany per 500 rows
 * (not one insert per row). `errors` counts vaults whose request failed or was
 * skipped at the time budget; fetch misses are counted, write errors propagate.
 */
export async function collectMarketAllocations(): Promise<{
  vaultsProcessed: number;
  allocationsStored: number;
  errors: number;
}> {
  let vaultsProcessed = 0;
  let allocationsStored = 0;
  let errors = 0;

  log("Starting market allocation collection...");

  // Morpho-sourced vaults only: Turtle rows have synthetic addresses the Morpho
  // API can't resolve. chainId comes from the row now that ingestion is multi-chain.
  const vaults = await prisma.vault.findMany({
    where: { active: true, dataSource: "morpho" },
    select: { id: true, address: true, name: true, chainId: true },
  });

  log(`Processing ${vaults.length} vaults...`);

  const startedAt = Date.now();
  const snapshotTime = new Date();

  // Group by chain, then VAULTS_PER_REQUEST addresses per request.
  const byChain = new Map<number, typeof vaults>();
  for (const vault of vaults) {
    const group = byChain.get(vault.chainId) ?? [];
    group.push(vault);
    byChain.set(vault.chainId, group);
  }
  const batches: { chainId: number; vaults: typeof vaults }[] = [];
  for (const [chainId, group] of byChain) {
    for (let i = 0; i < group.length; i += VAULTS_PER_REQUEST) {
      batches.push({ chainId, vaults: group.slice(i, i + VAULTS_PER_REQUEST) });
    }
  }

  const rows: Prisma.MarketAllocationCreateManyInput[] = [];
  // Same key as the unique index (snapshotTime is fixed for the run).
  const seen = new Set<string>();

  for (const [i, batch] of batches.entries()) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      const left = batches.slice(i).reduce((n, b) => n + b.vaults.length, 0);
      errors += left;
      logError(`Time budget reached; ${left} vaults not fetched this run`);
      break;
    }

    let items: VaultV2MarketCaps[];
    try {
      items = await fetchVaultsMarketCaps(
        batch.chainId,
        batch.vaults.map((v) => v.address)
      );
    } catch (err) {
      errors += batch.vaults.length;
      logError(
        `Failed for ${batch.vaults.length} vaults on chain ${batch.chainId} ` +
          `(${batch.vaults[0].name} ...)`,
        err
      );
      continue;
    }

    // Vaults absent from the response are V1 (MetaMorpho) or unknown to the API.
    const idByAddress = new Map(batch.vaults.map((v) => [v.address.toLowerCase(), v.id]));

    for (const vaultData of items) {
      const vaultId = idByAddress.get(vaultData.address.toLowerCase());
      if (!vaultId) continue;

      const totalAssetsUsd = vaultData.totalAssetsUsd || 0;
      const marketCaps = vaultData.caps.items.filter(
        (cap) => cap.type === "MarketV1" && cap.data?.market
      );

      if (marketCaps.length === 0) {
        continue;
      }

      for (const cap of marketCaps) {
        const market = cap.data.market!;
        const adapterAddress = cap.data.adapterAddress || "";
        const key = `${vaultId}|${market.marketId}|${adapterAddress}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const supplyAssetsUsd = market.state?.supplyAssetsUsd ?? 0;
        // allocation is in raw asset units; compute % of vault TVL using USD values
        const allocationPct = totalAssetsUsd > 0
          ? (supplyAssetsUsd / totalAssetsUsd) * 100
          : 0;

        rows.push({
          vaultId,
          marketUniqueKey: market.marketId,
          adapterAddress,
          loanAssetSymbol: market.loanAsset.symbol,
          loanAssetAddress: market.loanAsset.address,
          collateralAssetSymbol: market.collateralAsset?.symbol || "Unknown",
          collateralAssetAddress: market.collateralAsset?.address || "",
          lltv: parseFloat(market.lltv) / 1e18,
          supplyAssets: String(cap.allocation),
          supplyAssetsUsd,
          allocationPct: Math.min(allocationPct, 100),
          oracleAddress: market.oracle?.address || null,
          oracleType: market.oracle?.type || null,
          snapshotTime,
        });
      }

      vaultsProcessed++;
    }

    log(`  ${i + 1}/${batches.length} requests, ${vaultsProcessed} vaults with markets`);
    await sleep(API_DELAY_MS);
  }

  // Write errors propagate: a failed insert fails the step loudly.
  for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
    const result = await prisma.marketAllocation.createMany({
      data: rows.slice(i, i + WRITE_CHUNK),
      skipDuplicates: true,
    });
    allocationsStored += result.count;
  }

  log(`Market allocation collection complete: ${vaultsProcessed} vaults, ${allocationsStored} allocations, ${errors} errors`);
  return { vaultsProcessed, allocationsStored, errors };
}

// CLI entry point
async function main() {
  try {
    const result = await collectMarketAllocations();
    const totalInDb = await prisma.marketAllocation.count();
    log(`Database total: ${totalInDb} market allocation records`);

    if (result.errors > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    logError("Fatal error", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = require.main === module;
if (isDirectRun) {
  main();
}

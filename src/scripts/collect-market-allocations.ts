import { prisma } from "../lib/db";
import { morphoClient } from "../lib/graphql/client";
import { gql } from "graphql-request";

const API_DELAY_MS = 100;
const CHAIN_ID = 1;

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

const GET_VAULT_MARKET_CAPS = gql`
  query GetVaultMarketCaps($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
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
                uniqueKey
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
`;

interface MarketCapItem {
  type: string;
  allocation: string;
  data: {
    adapterAddress?: string;
    market?: {
      uniqueKey: string;
      loanAsset: { symbol: string; address: string };
      collateralAsset: { symbol: string; address: string } | null;
      lltv: string;
      oracle: { address: string; type: string | null } | null;
      state: { supplyAssetsUsd: number } | null;
    };
  };
}

interface VaultMarketCapsResponse {
  vaultV2ByAddress: {
    address: string;
    totalAssets: string;
    totalAssetsUsd: number;
    caps: {
      items: MarketCapItem[];
    };
  } | null;
}

export async function collectMarketAllocations(): Promise<{
  vaultsProcessed: number;
  allocationsStored: number;
  errors: number;
}> {
  let vaultsProcessed = 0;
  let allocationsStored = 0;
  let errors = 0;

  log("Starting market allocation collection...");

  const vaults = await prisma.vault.findMany({
    where: { active: true },
    select: { id: true, address: true, name: true },
  });

  log(`Processing ${vaults.length} vaults...`);

  const snapshotTime = new Date();

  for (const vault of vaults) {
    try {
      const response = await morphoClient.request<VaultMarketCapsResponse>(
        GET_VAULT_MARKET_CAPS,
        { address: vault.address, chainId: CHAIN_ID }
      );

      const vaultData = response.vaultV2ByAddress;
      if (!vaultData) {
        continue;
      }

      const totalAssetsUsd = vaultData.totalAssetsUsd || 0;
      const marketCaps = vaultData.caps.items.filter(
        (cap) => cap.type === "MarketV1" && cap.data?.market
      );

      if (marketCaps.length === 0) {
        continue;
      }

      for (const cap of marketCaps) {
        const market = cap.data.market!;
        const supplyAssetsUsd = market.state?.supplyAssetsUsd ?? 0;
        // allocation is in raw asset units; compute % of vault TVL using USD values
        const allocationPct = totalAssetsUsd > 0
          ? (supplyAssetsUsd / totalAssetsUsd) * 100
          : 0;

        await prisma.marketAllocation.create({
          data: {
            vaultId: vault.id,
            marketUniqueKey: market.uniqueKey,
            adapterAddress: cap.data.adapterAddress || "",
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
          },
        });
        allocationsStored++;
      }

      vaultsProcessed++;

      if (vaultsProcessed % 20 === 0) {
        log(`  ${vaultsProcessed}/${vaults.length} vaults processed`);
      }

      await sleep(API_DELAY_MS);
    } catch (err) {
      errors++;
      if (errors <= 5) {
        logError(`Failed for vault ${vault.name} (${vault.address})`, err);
      }
    }
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

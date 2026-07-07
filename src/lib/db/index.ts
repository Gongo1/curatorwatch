import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Serverless-optimized Prisma client with single connection
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

// Cache the client globally to prevent connection leaks
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

/**
 * Chain id for a vault address (case-insensitive), defaulting to Ethereum.
 * Live Morpho API lookups need the vault's actual chain now that ingestion
 * is multi-chain.
 */
export async function getVaultChainId(address: string): Promise<number> {
  const vault = await prisma.vault.findFirst({
    where: { address: { equals: address, mode: "insensitive" } },
    select: { chainId: true },
  });
  return vault?.chainId ?? 1;
}

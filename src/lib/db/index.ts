import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

// Cache the client in all environments (including production/serverless)
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

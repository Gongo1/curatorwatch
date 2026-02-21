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

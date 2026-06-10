-- CreateTable
CREATE TABLE "CuratorRating" (
    "id" TEXT NOT NULL,
    "curatorAddress" TEXT NOT NULL,
    "curatorKey" TEXT NOT NULL,
    "name" TEXT,
    "grade" TEXT NOT NULL,
    "elMedian" DOUBLE PRECISION NOT NULL,
    "elCiLow" DOUBLE PRECISION NOT NULL,
    "elCiHigh" DOUBLE PRECISION NOT NULL,
    "pLossAnnual" DOUBLE PRECISION,
    "lgdMedian" DOUBLE PRECISION,
    "channels" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "flags" JSONB NOT NULL,
    "nVaults" INTEGER,
    "tvlUsd" DOUBLE PRECISION,
    "exposureMonths" INTEGER,
    "events" INTEGER,
    "addresses" JSONB NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "modelGit" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuratorRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultRating" (
    "id" TEXT NOT NULL,
    "vaultKey" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "vaultAddress" TEXT NOT NULL,
    "curatorKey" TEXT,
    "grade" TEXT NOT NULL,
    "elMedian" DOUBLE PRECISION NOT NULL,
    "elCiLow" DOUBLE PRECISION NOT NULL,
    "elCiHigh" DOUBLE PRECISION NOT NULL,
    "pdAnnualMedian" DOUBLE PRECISION,
    "lgdMedian" DOUBLE PRECISION,
    "schemaVersion" TEXT NOT NULL,
    "modelGit" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VaultRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuratorRating_curatorAddress_key" ON "CuratorRating"("curatorAddress");

-- CreateIndex
CREATE INDEX "CuratorRating_curatorAddress_idx" ON "CuratorRating"("curatorAddress");

-- CreateIndex
CREATE INDEX "CuratorRating_grade_idx" ON "CuratorRating"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "VaultRating_vaultKey_key" ON "VaultRating"("vaultKey");

-- CreateIndex
CREATE INDEX "VaultRating_vaultAddress_idx" ON "VaultRating"("vaultAddress");

-- CreateIndex
CREATE INDEX "VaultRating_chainId_vaultAddress_idx" ON "VaultRating"("chainId", "vaultAddress");


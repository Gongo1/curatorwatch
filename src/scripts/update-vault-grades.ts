/**
 * Compute and persist vault risk scores + grades (5-factor model).
 *
 * Run standalone:  npx tsx src/scripts/update-vault-grades.ts
 * Called by cron:  import { updateVaultGrades } from "@/scripts/update-vault-grades"
 *
 * Grade assignment based on 9 hard requirements:
 *   "high-grade"   — pass all 9
 *   "medium-grade"  — fail 1-3 (pass 6-8)
 *   "low-grade"     — fail 4+ (pass ≤5)
 */

import { prisma } from "@/lib/db";
import {
  calculateVaultScores,
  qualifiesForHighGrade,
  type CuratorInput,
  type VaultScoreInput,
  type VaultScores,
} from "@/lib/utils/vault-risk-score";

export async function updateVaultGrades(): Promise<{
  total: number;
  qualified: number;
  highGrade: number;
  mediumGrade: number;
  lowGrade: number;
}> {
  // 1. Load all active vaults with curator + market allocations + latest snapshot + APR
  const vaults = await prisma.vault.findMany({
    where: { active: true },
    select: {
      id: true,
      address: true,
      name: true,
      assetSymbol: true,
      createdAt: true,
      curatorId: true,
      dataSource: true,
      netAPR: true,
      estTotalAPR: true,
      curator: {
        select: {
          entityType: true,
          foundedYear: true,
          totalAssetsManaged: true,
        },
      },
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: {
          totalAssetsUsd: true,
          avgNetApy: true,
        },
      },
      marketAllocations: {
        orderBy: { snapshotTime: "desc" },
        take: 50,
        select: {
          collateralAssetSymbol: true,
          marketUniqueKey: true,
          snapshotTime: true,
        },
      },
    },
  });

  // 2. Pre-compute curator bad-debt totals
  const curatorIds = [
    ...new Set(vaults.map((v) => v.curatorId).filter(Boolean)),
  ] as string[];

  const curatorBadDebt: Record<string, number> = {};

  for (const curatorId of curatorIds) {
    const curatorVaults = vaults.filter((v) => v.curatorId === curatorId);
    const marketKeys = new Set<string>();
    for (const v of curatorVaults) {
      for (const ma of v.marketAllocations) {
        marketKeys.add(ma.marketUniqueKey);
      }
    }

    if (marketKeys.size === 0) {
      curatorBadDebt[curatorId] = 0;
      continue;
    }

    const result = await prisma.liquidation.aggregate({
      where: {
        marketUniqueKey: { in: [...marketKeys] },
        badDebtAssetsUsd: { gt: 0 },
      },
      _sum: { badDebtAssetsUsd: true },
    });

    curatorBadDebt[curatorId] = result._sum.badDebtAssetsUsd ?? 0;
  }

  // 3. Score every vault
  interface ScoredVault {
    id: string;
    name: string;
    scores: VaultScores;
    qualifies: boolean;
    failures: string[];
  }

  const scored: ScoredVault[] = [];

  for (const vault of vaults) {
    // Collateral assets from latest MarketAllocation or fallback
    let collateralAssets: string[];
    if (vault.marketAllocations.length > 0) {
      const latestTime = vault.marketAllocations[0].snapshotTime.getTime();
      collateralAssets = vault.marketAllocations
        .filter((ma) => ma.snapshotTime.getTime() === latestTime)
        .map((ma) => ma.collateralAssetSymbol);
    } else {
      collateralAssets = [vault.assetSymbol];
    }

    // Per-vault liquidation stats
    const vaultMarketKeys = vault.marketAllocations.map(
      (ma) => ma.marketUniqueKey
    );
    let liquidationCount = 0;
    let hasBadDebt = false;

    if (vaultMarketKeys.length > 0) {
      const uniqueKeys = [...new Set(vaultMarketKeys)];
      const liqStats = await prisma.liquidation.aggregate({
        where: { marketUniqueKey: { in: uniqueKeys } },
        _count: true,
        _sum: { badDebtAssetsUsd: true },
      });
      liquidationCount = liqStats._count;
      hasBadDebt = (liqStats._sum.badDebtAssetsUsd ?? 0) > 1; // ignore dust below $1
    }

    // TVL from latest snapshot
    const tvl = vault.snapshots[0]?.totalAssetsUsd ?? 0;

    // Effective APR: Turtle uses netAPR, Morpho uses avgNetApy * 100
    let effectiveAPR = 0;
    if (vault.dataSource === "turtle") {
      effectiveAPR = vault.netAPR ?? vault.estTotalAPR ?? 0;
    } else {
      effectiveAPR = (vault.snapshots[0]?.avgNetApy ?? 0) * 100;
    }

    // Build curator input (defensive null handling)
    let curatorInput: CuratorInput | null = null;
    if (vault.curator && vault.curatorId) {
      curatorInput = {
        entityType: vault.curator.entityType || null,
        foundedYear: vault.curator.foundedYear || null,
        totalAUM: vault.curator.totalAssetsManaged || 0,
        badDebtUsd: curatorBadDebt[vault.curatorId] || 0,
      };
    }

    const input: VaultScoreInput = {
      tvl: tvl || 0,
      createdAt: vault.createdAt,
      curator: curatorInput,
      collateralAssets,
      liquidationCount: liquidationCount || 0,
      hasBadDebt: hasBadDebt || false,
      netAPR: effectiveAPR || 0,
    };

    const scores = calculateVaultScores(input);
    const { qualifies, failures } = qualifiesForHighGrade(input);

    scored.push({
      id: vault.id,
      name: vault.name,
      scores,
      qualifies,
      failures,
    });
  }

  // 4. Separate qualified vs disqualified
  const qualified = scored.filter((v) => v.qualifies);
  const disqualified = scored.filter((v) => !v.qualifies);

  // Log disqualification reasons
  if (disqualified.length > 0) {
    console.log(
      `[vault-grades] ${disqualified.length} vaults disqualified from high-grade:`
    );
    // Aggregate failure reasons
    const failureCounts: Record<string, number> = {};
    for (const v of disqualified) {
      for (const f of v.failures) {
        // Normalize to reason category (strip specific numbers)
        const category = f.replace(/\$[\d.]+[MK]?/g, "$X").replace(/[\d.]+[%d]/g, "X");
        failureCounts[category] = (failureCounts[category] ?? 0) + 1;
      }
    }
    for (const [reason, count] of Object.entries(failureCounts).sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`  ${count}x ${reason}`);
    }
  }

  // 5. Assign grades based on failure count:
  //    0 failures = "high-grade", 1-3 = "medium-grade", 4+ = "low-grade"
  function assignGrade(failureCount: number): string {
    if (failureCount === 0) return "high-grade";
    if (failureCount <= 3) return "medium-grade";
    return "low-grade";
  }

  const updates: Array<{
    id: string;
    riskScore: number;
    grade: string;
    sizeScore: number;
    maturityScore: number;
    curatorScore: number;
    collateralScore: number;
    riskIndicatorScore: number;
    gradeFailures: string[];
  }> = [];

  for (const v of scored) {
    updates.push({
      id: v.id,
      riskScore: v.scores.total,
      grade: assignGrade(v.failures.length),
      sizeScore: v.scores.sizeScore,
      maturityScore: v.scores.maturityScore,
      curatorScore: v.scores.curatorScore,
      collateralScore: v.scores.collateralScore,
      riskIndicatorScore: v.scores.riskIndicatorScore,
      gradeFailures: v.failures,
    });
  }

  // 6. Batch-update in transaction (chunks of 50)
  const CHUNK = 50;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    await prisma.$transaction(
      chunk.map((u) =>
        prisma.vault.update({
          where: { id: u.id },
          data: {
            riskScore: u.riskScore,
            grade: u.grade,
            sizeScore: u.sizeScore,
            maturityScore: u.maturityScore,
            curatorScore: u.curatorScore,
            collateralScore: u.collateralScore,
            riskIndicatorScore: u.riskIndicatorScore,
            gradeFailures: u.gradeFailures,
          },
        })
      )
    );
  }

  const highGrade = updates.filter((u) => u.grade === "high-grade").length;
  const mediumGrade = updates.filter((u) => u.grade === "medium-grade").length;
  const lowGrade = updates.filter((u) => u.grade === "low-grade").length;

  console.log(
    `[vault-grades] Updated ${updates.length} vaults: ` +
      `${highGrade} high-grade, ${mediumGrade} medium-grade, ${lowGrade} low-grade`
  );

  return { total: updates.length, qualified: qualified.length, highGrade, mediumGrade, lowGrade };
}

// ── Standalone runner ──────────────────────────────────────────────────
const isMain = process.argv[1]?.includes("update-vault-grades");
if (isMain) {
  updateVaultGrades()
    .then((result) => {
      console.log("Done:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed:", err);
      process.exit(1);
    });
}

/**
 * Hyperliquid HLP collection (P5 of the coverage roadmap).
 *
 * Deliberately minimal: ONE vault — the flagship Hyperliquidity Provider
 * (HLP), ~$260M, attributed to a "Hyperliquid" curator row. HLP is an
 * actively managed market-making/liquidation strategy (curator-like), unlike
 * bare lending-protocol infrastructure. HLP's own sub-vaults and the
 * pseudonymous Hypercore copy-trading tail are excluded by policy and
 * REPORTED every run (see lib/hyperliquid/client.ts).
 */

import { prisma } from "../lib/db";
import { fetchHlp, HLP_VAULT_ADDRESS } from "../lib/hyperliquid/client";
import { matchCurator } from "../lib/turtle/curator-matcher";
import { canonicalChainName, getChainId } from "../lib/turtle/chain-mapper";
import { sanitizeApyPct } from "../lib/utils/sanitize-apy";
import { assessPhantom } from "../lib/data-quality/phantom";
import { finalizeCollection, recordSnapshotWritten } from "../lib/data-quality/maintenance";

export interface HyperliquidCollectionResult {
  success: boolean;
  vaultsUpserted: number;
  hlpTvlUsd: number;
  childrenExcluded: { name: string; tvlUsd: number }[];
  notableSkipped: { name: string; tvlUsd: number; aprPct: number }[];
  errors: string[];
  duration: number;
}

function log(message: string) {
  console.log(`[${new Date().toISOString()}] [HYPERLIQUID] ${message}`);
}

export async function collectHyperliquidData(): Promise<HyperliquidCollectionResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  log("=".repeat(60));
  log("Starting Hyperliquid HLP collection...");

  try {
    const hlp = await fetchHlp();
    const chainId = getChainId("hypercore");
    const chainName = canonicalChainName(chainId);

    const curatorId = await matchCurator(hlp.name, {
      name: "Hyperliquid",
      landingUrl: "https://hyperliquid.xyz",
    });
    if (!curatorId) {
      throw new Error("Could not resolve the Hyperliquid curator row");
    }

    const estTotalAPR = sanitizeApyPct(hlp.aprPct);
    const aprDecimal = estTotalAPR != null ? estTotalAPR / 100 : null;

    const vaultFields = {
      name: hlp.name,
      protocol: "hyperliquid",
      curatorId,
      dataSource: "hyperliquid" as const,
      opportunityType: "vault",
      chainId,
      chainName,
      onchainAddress: hlp.vaultAddress.toLowerCase(),
      onchainSymbol: "HLP",
      estTotalAPR,
      netAPR: estTotalAPR,
      creationTimestamp: hlp.createTimeMillis
        ? Math.floor(hlp.createTimeMillis / 1000)
        : undefined,
      active: true,
    };

    const row = await prisma.vault.upsert({
      where: { address: HLP_VAULT_ADDRESS },
      update: { ...vaultFields, updatedAt: new Date() },
      create: {
        address: HLP_VAULT_ADDRESS,
        symbol: "HLP",
        assetAddress: "unknown",
        assetSymbol: "USDC",
        assetDecimals: 6,
        ...vaultFields,
      },
    });

    await prisma.vaultSnapshot.create({
      data: {
        vaultId: row.id,
        totalAssets: "0",
        totalAssetsUsd: hlp.tvlUsd,
        totalSupply: "0",
        sharePrice: 1,
        apy: aprDecimal,
        netApy: aprDecimal,
        avgApy: aprDecimal,
        avgNetApy: aprDecimal,
      },
    });
    // Phantom test on the RAW source APR (the stored value is sanitized).
    await recordSnapshotWritten(
      row.id,
      assessPhantom({ apy: hlp.aprPct != null ? hlp.aprPct / 100 : null, assetSymbol: "USDC" })
    );

    // Totals hygiene: exclusion flags, then curator stats over counted vaults.
    await finalizeCollection();

    const duration = Date.now() - startTime;
    log(`  HLP upserted: $${(hlp.tvlUsd / 1e6).toFixed(1)}M, APR ${estTotalAPR?.toFixed(2) ?? "—"}%`);
    log(`  HLP sub-vaults excluded (capital contained in HLP): ${hlp.children.length} ($${(hlp.children.reduce((s, c) => s + c.tvlUsd, 0) / 1e6).toFixed(1)}M)`);
    log(`  Non-HLP tail ≥$5M skipped by policy: ${hlp.notableSkipped.length}`);
    for (const s of hlp.notableSkipped.slice(0, 5)) {
      log(`    ${s.name} ($${(s.tvlUsd / 1e6).toFixed(1)}M, ${s.aprPct.toFixed(0)}% APR)`);
    }
    log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    log("=".repeat(60));

    return {
      success: true,
      vaultsUpserted: 1,
      hlpTvlUsd: hlp.tvlUsd,
      childrenExcluded: hlp.children,
      notableSkipped: hlp.notableSkipped,
      errors,
      duration,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[HYPERLIQUID] ERROR:`, error);
    errors.push(msg);
    return {
      success: false,
      vaultsUpserted: 0,
      hlpTvlUsd: 0,
      childrenExcluded: [],
      notableSkipped: [],
      errors,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Phase 3a/3b: distributor deal mapping + attributed deposit ingestion.
 *
 * Server-side use of the Earn API (approved 2026-06-09; read-only GETs:
 * distributor opportunities + distributor deposits). Auth is the server-only
 * TURTLE_API_KEY sent as `X-API-Key` (Turtle stopped reading Bearer tokens on
 * 2026-09-18). Runs from the collect-turtle cron after the main collection pass.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { turtleApiKey } from "./client";

const EARN_API_BASE = "https://earn.turtle.xyz/v1";
const DISTRIBUTOR_ID = process.env.NEXT_PUBLIC_TURTLE_DISTRIBUTOR_ID ?? "";

interface DealToken {
  address?: string;
  chain?: { chainId?: string | number };
}

interface DealOpportunity {
  id: string;
  name: string;
  estimatedApr?: number;
  swapDirectEnabled?: boolean;
  swapRouteEnabled?: boolean;
  receiptToken?: DealToken;
}

interface ApiDeposit {
  id?: string;
  opportunityId?: string;
  interaction?: string;
  txHash: string;
  chainId?: number;
  blockTimestamp?: string | null;
  walletAddress: string;
  amountToken?: string | null;
  amountInUsd?: string | null;
  tokenSymbol?: string | null;
}

export interface DealSyncSummary {
  opportunities: number;
  mapped: number;
  updated: number;
  cleared: number;
  unmatchedOpportunities: number;
  depositsFetched: number;
  depositsUpserted: number;
  depositsUnmatchedVault: number;
}

async function earnGet<T>(path: string): Promise<T> {
  const res = await fetch(`${EARN_API_BASE}${path}`, {
    headers: { "X-API-Key": turtleApiKey() },
  });
  if (!res.ok) {
    throw new Error(`Earn API ${path} -> ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

function unwrapList<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

/**
 * Map distributor opportunities onto Vault rows.
 * Match order: turtleId (Turtle-sourced vaults), then receiptToken
 * address+chain (Morpho-sourced — the receipt token IS the vault share token).
 * Unmatched opportunities are counted and logged, never silently dropped.
 * Rows are written only when the mapping changed; dealCheckedAt stamps the write.
 */
async function syncDealMapping() {
  const raw = await earnGet<unknown>(
    `/opportunities/distributors/${DISTRIBUTOR_ID}`
  );
  const opps = unwrapList<DealOpportunity>(raw, "opportunities");
  // An empty list would clear every existing deal mapping below. The distributor
  // always has deals, so treat empty as a response-shape or auth problem.
  if (opps.length === 0) {
    throw new Error(
      "Earn API returned 0 distributor opportunities; refusing to clear deal mappings"
    );
  }

  const vaults = await prisma.vault.findMany({
    select: {
      id: true,
      address: true,
      chainId: true,
      turtleId: true,
      dealOpportunityId: true,
      dealDepositable: true,
      dealEstApr: true,
    },
  });
  const byTurtleId = new Map(
    vaults.filter((v) => v.turtleId).map((v) => [v.turtleId as string, v])
  );
  const byAddrChain = new Map(
    vaults.map((v) => [`${v.address.toLowerCase()}:${v.chainId}`, v])
  );

  const now = new Date();
  const updates: {
    vaultId: string;
    oppId: string;
    depositable: boolean;
    estApr: number | null;
  }[] = [];
  const mappedVaultIds = new Set<string>();
  const unmatched: string[] = [];

  for (const o of opps) {
    const rt = o.receiptToken;
    const viaReceipt =
      rt?.address && rt.chain?.chainId != null
        ? byAddrChain.get(
            `${rt.address.toLowerCase()}:${Number(rt.chain.chainId)}`
          )
        : undefined;
    const vault = byTurtleId.get(o.id) ?? viaReceipt;
    if (!vault) {
      unmatched.push(`${o.name} (${o.id})`);
      continue;
    }
    if (mappedVaultIds.has(vault.id)) continue; // first match wins
    mappedVaultIds.add(vault.id);
    const depositable = Boolean(o.swapDirectEnabled || o.swapRouteEnabled);
    const estApr = o.estimatedApr ?? null;
    const changed =
      vault.dealOpportunityId !== o.id ||
      vault.dealDepositable !== depositable ||
      vault.dealEstApr !== estApr;
    if (changed) {
      updates.push({ vaultId: vault.id, oppId: o.id, depositable, estApr });
    }
  }

  // Vaults whose deal no longer appears under the distributor.
  const toClear = vaults.filter(
    (v) => v.dealOpportunityId && !mappedVaultIds.has(v.id)
  );

  // Clear stale mappings before writing new ones so a deal that moved between
  // vaults can't trip the dealOpportunityId unique constraint mid-transaction.
  // Set-based: one updateMany for the clears, then one UPDATE ... FROM (VALUES
  // ...) for the changed mappings (the unique index is checked row by row, so
  // vaults whose deal id changes are nulled first, making swaps safe too).
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  if (toClear.length > 0) {
    ops.push(
      prisma.vault.updateMany({
        where: { id: { in: toClear.map((v) => v.id) } },
        data: {
          dealOpportunityId: null,
          dealDepositable: false,
          dealEstApr: null,
          dealCheckedAt: now,
        },
      })
    );
  }
  if (updates.length > 0) {
    const current = new Map(vaults.map((v) => [v.id, v.dealOpportunityId]));
    const moving = updates
      .filter((u) => current.get(u.vaultId) !== null && current.get(u.vaultId) !== u.oppId)
      .map((u) => u.vaultId);
    if (moving.length > 0) {
      ops.push(
        prisma.vault.updateMany({
          where: { id: { in: moving } },
          data: { dealOpportunityId: null },
        })
      );
    }
    const values = Prisma.join(
      updates.map(
        (u) =>
          Prisma.sql`(${u.vaultId}::text, ${u.oppId}::text, ${u.depositable}::boolean, ${u.estApr}::float8)`
      )
    );
    ops.push(prisma.$executeRaw`
      UPDATE "Vault" AS v
      SET "dealOpportunityId" = d.opp_id,
          "dealDepositable" = d.depositable,
          "dealEstApr" = d.est_apr,
          "dealCheckedAt" = ${now},
          "updatedAt" = ${now}
      FROM (VALUES ${values}) AS d(id, opp_id, depositable, est_apr)
      WHERE v.id = d.id
    `);
  }
  if (ops.length > 0) await prisma.$transaction(ops);

  if (unmatched.length > 0) {
    console.log(
      `[deal-sync] ${unmatched.length}/${opps.length} distributor opportunities have no tracked vault (expected: untracked protocols). Sample: ${unmatched
        .slice(0, 5)
        .join("; ")}`
    );
  }

  return {
    opportunities: opps.length,
    mapped: mappedVaultIds.size,
    updated: updates.length,
    cleared: toClear.length,
    unmatchedOpportunities: unmatched.length,
  };
}

/** Page through the distributor's attributed deposits and upsert them. */
async function syncDeposits() {
  const PAGE_LIMIT = 100;
  const MAX_PAGES = 50;
  const all: ApiDeposit[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const raw = await earnGet<unknown>(
      `/deposit/${DISTRIBUTOR_ID}?page=${page}&limit=${PAGE_LIMIT}`
    );
    const batch = unwrapList<ApiDeposit>(raw, "deposits");
    all.push(...batch);
    const pagination =
      raw && typeof raw === "object"
        ? (raw as { pagination?: { hasNext?: boolean } }).pagination
        : undefined;
    if (pagination ? !pagination.hasNext : batch.length < PAGE_LIMIT) break;
  }

  // Resolve deposits to vaults through the deal mapping (dealOpportunityId for
  // mapped deals, turtleId for Turtle-sourced vaults).
  const oppIds = [
    ...new Set(all.map((d) => d.opportunityId).filter(Boolean)),
  ] as string[];
  const vaultRows = oppIds.length
    ? await prisma.vault.findMany({
        where: {
          OR: [
            { dealOpportunityId: { in: oppIds } },
            { turtleId: { in: oppIds } },
          ],
        },
        select: { id: true, dealOpportunityId: true, turtleId: true },
      })
    : [];
  const vaultByOpp = new Map<string, string>();
  for (const v of vaultRows) {
    if (v.dealOpportunityId) vaultByOpp.set(v.dealOpportunityId, v.id);
    if (v.turtleId) vaultByOpp.set(v.turtleId, v.id);
  }

  let upserted = 0;
  let unmatchedVault = 0;
  for (const d of all) {
    // id is Turtle's stable deposit UUID; txHash+interaction is the defensive
    // fallback key if it's ever absent.
    const id = d.id ?? `${d.txHash}:${d.interaction ?? "deposit"}`;
    const vaultId = d.opportunityId
      ? vaultByOpp.get(d.opportunityId) ?? null
      : null;
    if (!vaultId) unmatchedVault++;
    const data = {
      opportunityId: d.opportunityId ?? null,
      vaultId,
      interaction: d.interaction ?? "deposit",
      txHash: d.txHash,
      chainId: d.chainId ?? null,
      walletAddress: d.walletAddress,
      amountToken: d.amountToken ?? null,
      amountInUsd: d.amountInUsd != null ? Number(d.amountInUsd) : null,
      tokenSymbol: d.tokenSymbol ?? null,
      blockTimestamp: d.blockTimestamp ? new Date(d.blockTimestamp) : null,
    };
    await prisma.depositRecord.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    upserted++;
  }

  return {
    depositsFetched: all.length,
    depositsUpserted: upserted,
    depositsUnmatchedVault: unmatchedVault,
  };
}

export async function syncDealsAndDeposits(): Promise<DealSyncSummary> {
  turtleApiKey(); // throws when TURTLE_API_KEY is missing
  if (!DISTRIBUTOR_ID) {
    throw new Error("NEXT_PUBLIC_TURTLE_DISTRIBUTOR_ID not set");
  }
  const mapping = await syncDealMapping();
  const deposits = await syncDeposits();
  return { ...mapping, ...deposits };
}

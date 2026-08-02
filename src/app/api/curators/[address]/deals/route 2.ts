import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCuratorSlug } from "@/lib/curator-aliases";
import { cacheGet, cacheSet } from "@/lib/cache";

export const dynamic = "force-dynamic";

// Live curator deals, sourced straight from Turtle's distributor opportunities —
// NOT the 12h-synced DB mapping. So when a deal is removed from the distributor
// dashboard it disappears here within the short cache window, and TVL/APR come
// from the opportunity itself (what the dashboard shows), not our vault snapshot.

const EARN_API_BASE = "https://earn.turtle.xyz/v1";
const API_KEY = process.env.NEXT_PUBLIC_TURTLE_API_KEY ?? "";
const DISTRIBUTOR_ID = process.env.NEXT_PUBLIC_TURTLE_DISTRIBUTOR_ID ?? "";
const DEPOSIT_ENABLED = process.env.NEXT_PUBLIC_FEATURE_TURTLE_DEPOSIT === "true";

interface OppToken {
  address?: string;
  symbol?: string;
  chain?: { chainId?: string | number };
}
interface DistOpp {
  id: string;
  name: string;
  tvl?: number;
  estimatedApr?: number;
  swapDirectEnabled?: boolean;
  swapRouteEnabled?: boolean;
  receiptToken?: OppToken;
  depositTokens?: OppToken[];
}

// The full distributor set is the same for every curator, so cache it briefly
// (shared key) — near-real-time without hammering Turtle on every profile view.
async function fetchDistributorOpps(): Promise<DistOpp[]> {
  const cacheKey = "turtle:distributor-opps";
  const cached = await cacheGet(cacheKey);
  if (cached) return cached as DistOpp[];
  if (!API_KEY || !DISTRIBUTOR_ID) return [];
  const res = await fetch(
    `${EARN_API_BASE}/opportunities/distributors/${DISTRIBUTOR_ID}`,
    { headers: { Authorization: `Bearer ${API_KEY}` }, cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  const opps = Array.isArray(data)
    ? (data as DistOpp[])
    : (((data as Record<string, unknown>).opportunities ??
        (data as Record<string, unknown>).data ??
        []) as DistOpp[]);
  await cacheSet(cacheKey, opps, 30); // 30s — fast enough to feel live
  return opps;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  if (!DEPOSIT_ENABLED) return NextResponse.json({ deals: [] });

  const resolved = await resolveCuratorSlug(address);
  const curator = await prisma.curator.findUnique({
    where: { address: resolved },
    select: { id: true },
  });
  if (!curator) return NextResponse.json({ deals: [] });

  const vaults = await prisma.vault.findMany({
    where: { curatorId: curator.id, active: true },
    select: {
      id: true,
      name: true,
      turtleId: true,
      address: true,
      chainId: true,
      assetSymbol: true,
      chainName: true,
    },
  });
  const byTurtleId = new Map(
    vaults.filter((v) => v.turtleId).map((v) => [v.turtleId as string, v])
  );
  const byAddrChain = new Map(
    vaults.map((v) => [`${v.address.toLowerCase()}:${v.chainId}`, v])
  );

  const opps = await fetchDistributorOpps();
  const seen = new Set<string>();
  const deals: {
    opportunityId: string;
    vaultId: string;
    vaultName: string;
    assetSymbol: string | null;
    chainName: string | null;
    estApr: number | null;
    tvl: number | null;
  }[] = [];

  for (const o of opps) {
    // Match the live opportunity to one of this curator's vaults — turtleId for
    // Turtle-sourced, else receipt-token address+chain (the share token).
    const rt = o.receiptToken;
    const viaReceipt =
      rt?.address && rt.chain?.chainId != null
        ? byAddrChain.get(`${rt.address.toLowerCase()}:${Number(rt.chain.chainId)}`)
        : undefined;
    const vault = byTurtleId.get(o.id) ?? viaReceipt;
    if (!vault || seen.has(vault.id)) continue;
    if (!(o.swapDirectEnabled || o.swapRouteEnabled)) continue; // depositable only
    seen.add(vault.id);
    deals.push({
      opportunityId: o.id,
      vaultId: vault.id,
      vaultName: vault.name,
      assetSymbol: o.depositTokens?.[0]?.symbol ?? vault.assetSymbol ?? null,
      chainName: vault.chainName,
      estApr: o.estimatedApr ?? null, // from the opportunity
      tvl: o.tvl ?? null, // from the opportunity
    });
  }

  deals.sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));

  return NextResponse.json(
    { deals },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } }
  );
}

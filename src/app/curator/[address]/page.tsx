import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchCuratorDetail } from "@/lib/curator-detail";
import { getCuratorEngineRating, getVaultEngineRatings } from "@/lib/curator-engine-rating";
import { CuratorProfileView } from "./profile-client";

// ISR aligned to the ingestion cadence: the cron revalidates curator pages on
// completion (see /api/cron/*); 6h is the fallback ceiling if a trigger is missed.
export const revalidate = 21600;

// Empty list = no paths prerendered at build; each curator page is rendered on
// first request, then cached per-path under the revalidate window above.
export async function generateStaticParams(): Promise<{ address: string }[]> {
  return [];
}

interface PageProps {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params;
  const data = await fetchCuratorDetail(address);
  if (!data) return { title: "Curator not found - CuratorWatch" };

  const name = data.curator.name || `Curator ${data.curator.address.slice(0, 6)}`;
  const tvl = data.vaults.reduce((s, v) => s + (v.latestSnapshot?.totalAssetsUsd ?? 0), 0);
  const tvlStr =
    tvl >= 1e9 ? `$${(tvl / 1e9).toFixed(2)}B` : `$${(tvl / 1e6).toFixed(1)}M`;
  return {
    title: `${name} - Curator Profile - CuratorWatch`,
    description: `${name} manages ${data.vaults.length} vaults with ${tvlStr} TVL. Track record, risk signals, managed vaults, and yield intelligence on CuratorWatch.`,
  };
}

export default async function CuratorProfile({ params }: PageProps) {
  const { address } = await params;

  // No try/catch: a transient DB error must throw (ISR keeps serving the last
  // good render) rather than cache a "not found" page for 6h.
  const data = await fetchCuratorDetail(address);

  if (!data) {
    return (
      <div className="py-8 max-w-[1000px]">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-primary transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to curators
        </Link>
        <div className="bg-background-subtle rounded-2xl border border-border p-8 text-center">
          <h2 className="font-display text-lg font-bold text-text-primary">Curator not found</h2>
          <p className="mt-2 text-sm text-text-secondary">This curator doesn’t exist.</p>
          <p className="mt-1 text-xs text-text-tertiary font-mono">{address}</p>
        </div>
      </div>
    );
  }

  // Loss-anchored grades are server-rendered from precomputed DB (flag-gated; empty
  // when the flag is off or no rating exists). Coexist with the 7-factor profile.
  const [engineRating, vaultRatings] = await Promise.all([
    getCuratorEngineRating(data.curator.address),
    getVaultEngineRatings(data.vaults.map((v) => ({ chainId: v.chainId, address: v.address }))),
  ]);

  return <CuratorProfileView data={data} engineRating={engineRating} vaultRatings={vaultRatings} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fetchCuratorDetail } from "@/lib/curator-detail";
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
    description: `${name} manages ${data.vaults.length} vaults with ${tvlStr} TVL. Track record, managed vaults, and yield intelligence on CuratorWatch.`,
  };
}

export default async function CuratorProfile({ params }: PageProps) {
  const { address } = await params;

  // No try/catch: a transient DB error must throw (ISR keeps serving the last
  // good render) rather than cache a "not found" page for 6h.
  const data = await fetchCuratorDetail(address);

  if (!data) {
    return (
      <div className="max-w-[720px]">
        <section className="panel">
          <div className="panel-head">
            <h1 className="panel-title">Curator not found</h1>
          </div>
          <div className="p-3">
            <p className="text-sm text-text-secondary">
              No tracked curator matches this address or name. Check the link, or find the curator in the ranking.
            </p>
            <p className="mt-1.5 num text-xs text-text-tertiary break-all">{address}</p>
            <Link href="/" className="btn btn-ghost mt-3">
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to curators
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return <CuratorProfileView data={data} />;
}

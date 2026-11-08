import type { Metadata } from "next";
import Link from "next/link";
import { fetchVaultDetail } from "@/lib/vault-detail";
import { formatCurrency } from "@/lib/utils/format";
import { VaultDetailView } from "./vault-client";

// ISR aligned to the ingestion cadence: the cron revalidates vault pages on
// completion (see /api/cron/*); 6h is the fallback ceiling if a trigger is missed.
export const revalidate = 21600;

// Empty list = no paths prerendered at build; each vault page is rendered on
// first request, then cached per-path under the revalidate window above.
export async function generateStaticParams(): Promise<{ address: string }[]> {
  return [];
}

interface PageProps {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { address } = await params;
  const vault = await fetchVaultDetail(address);
  if (!vault) return { title: "Vault not found - CuratorWatch" };

  const tvl = vault.latestSnapshot?.totalAssetsUsd ?? 0;
  const curator = vault.curator?.name ? ` curated by ${vault.curator.name}` : "";
  return {
    title: `${vault.name} - Vault Intelligence - CuratorWatch`,
    description: `${vault.name} (${vault.asset.symbol})${curator}: ${formatCurrency(tvl)} TVL, yield history, allocations, and changes on CuratorWatch.`,
  };
}

export default async function VaultDetailPage({ params }: PageProps) {
  const { address } = await params;

  // No try/catch: a transient DB error must throw (ISR keeps serving the last
  // good render) rather than cache a "not found" page for 6h.
  const vault = await fetchVaultDetail(address);

  if (!vault) {
    return (
      <div className="space-y-1.5">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 label">
          <Link href="/" className="hover:text-accent-blue transition-colors">
            Curators
          </Link>
          <span className="text-text-muted">/</span>
          <span className="text-text-secondary">Vault</span>
        </nav>

        <section className="panel max-w-2xl">
          <div className="panel-head">
            <h1 className="panel-title text-accent-red">Vault not found</h1>
          </div>
          <div className="p-3">
            <p className="text-sm text-text-secondary">
              No vault with this address is tracked. Check the address, or find the vault from its curator&rsquo;s page.
            </p>
            <p className="num mt-1.5 text-xs text-text-muted break-all">{address}</p>
            <Link href="/" className="btn btn-ghost h-7 mt-3">
              Back to curators
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return <VaultDetailView address={address} vault={vault} />;
}

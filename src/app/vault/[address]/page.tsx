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
    description: `${vault.name} (${vault.asset.symbol})${curator}: ${formatCurrency(tvl)} TVL, yield history, risk assessment, allocations, and changes on CuratorWatch.`,
  };
}

export default async function VaultDetailPage({ params }: PageProps) {
  const { address } = await params;

  // No try/catch: a transient DB error must throw (ISR keeps serving the last
  // good render) rather than cache a "not found" page for 6h.
  const vault = await fetchVaultDetail(address);

  if (!vault) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav className="flex items-center gap-2 text-sm mb-6">
          <Link href="/" className="text-text-tertiary hover:text-text-primary transition-colors">
            Curators
          </Link>
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-text-primary font-medium">Vault</span>
        </nav>

        <div className="bg-background-subtle rounded-lg border border-accent-red/30 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-accent-red/15 flex items-center justify-center mx-auto">
            <svg className="h-8 w-8 text-accent-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-medium text-text-primary">Vault Not Found</h2>
          <p className="mt-2 text-sm text-text-secondary">
            The vault you&rsquo;re looking for doesn&rsquo;t exist.
          </p>
          <p className="mt-1 text-xs text-text-muted font-mono">{address}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary bg-background-elevated hover:bg-background-hover transition-colors"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <VaultDetailView address={address} vault={vault} />;
}

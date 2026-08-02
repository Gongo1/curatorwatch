import type { Metadata } from "next";
import Link from "next/link";
import { Rss } from "lucide-react";
import { getLatestDigest, getRecentDigests } from "@/lib/digest/read";
import { DigestView } from "./DigestView";
import { PersonalDigestPanel } from "./PersonalDigestPanel";
import type { DigestData } from "@/lib/digest/types";

// ISR aligned to ingestion; the digest cron revalidates /digest on completion.
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Curator Daily — CuratorWatch",
  description:
    "The nightly Curator Daily: TVL flows, single-manager concentration, yield moves, new vaults, incidents, and the Curator Stress Index — across every tracked DeFi vault curator.",
};

export default async function DigestPage() {
  const latest = await getLatestDigest();
  const recent = await getRecentDigests(30);

  if (!latest) {
    return (
      <div className="max-w-[1000px]">
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary">Curator Daily</div>
        <h1 className="font-display font-bold text-3xl tracking-tight mt-2 mb-3">The nightly curator digest</h1>
        <p className="text-text-secondary max-w-[640px]">
          The first edition publishes after tonight&rsquo;s build. Curator Daily covers TVL flows,
          single-manager concentration, yield moves, new vaults, incidents, and the Curator Stress
          Index — every claim links back to a curator or vault.
        </p>
        <Link href="/feed/digest.xml" className="inline-flex items-center gap-2 mt-5 font-mono text-xs text-accent-blue">
          <Rss className="w-4 h-4" /> Subscribe via RSS
        </Link>
      </div>
    );
  }

  const data = latest.structuredJson as unknown as DigestData;
  const archive = recent.filter((r) => r.slug !== latest.slug);

  return (
    <div className="max-w-[1000px]">
      <DigestView
        title={latest.title}
        summary={latest.summary}
        date={latest.date}
        generatedBy={latest.generatedBy}
        data={data}
      />

      <PersonalDigestPanel data={data} />

      <div className="mt-8 flex items-center gap-4 flex-wrap">
        <Link href="/feed/digest.xml" className="inline-flex items-center gap-2 font-mono text-xs text-accent-blue">
          <Rss className="w-4 h-4" /> RSS feed
        </Link>
      </div>

      {archive.length > 0 && (
        <section className="mt-10">
          <div className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary mb-3 pb-2 border-b border-border">
            Archive
          </div>
          <div className="divide-y divide-border-subtle">
            {archive.map((d) => (
              <Link
                key={d.slug}
                href={`/digest/${d.slug}`}
                className="flex items-center justify-between gap-3 py-2.5 hover:bg-background-subtle px-2 -mx-2 rounded transition-colors group"
              >
                <span className="font-mono text-sm text-text-secondary group-hover:text-accent-blue transition-colors truncate">
                  {d.slug} · {d.title}
                </span>
                {d.stressBand && (
                  <span className="font-mono text-[11px] text-text-tertiary whitespace-nowrap tabular-nums">
                    stress {d.stressScore ?? "—"} {d.stressBand}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Rss } from "lucide-react";
import { getLatestDigest, getRecentDigests } from "@/lib/digest/read";
import { DigestView } from "./DigestView";
import { PersonalDigestPanel } from "./PersonalDigestPanel";
import type { DigestData } from "@/lib/digest/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/layout/Panel";

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
      <div className="space-y-1.5">
        <PageHeader title="Curator Daily" description="The nightly curator digest." />
        <Panel title="First edition pending" bodyClassName="p-3">
          <p className="text-sm text-text-secondary leading-relaxed max-w-[70ch]">
            The first edition publishes after tonight&rsquo;s build. Curator Daily covers TVL flows,
            single-manager concentration, yield moves, new vaults, incidents, and the Curator Stress
            Index. Every claim links back to a curator or vault.
          </p>
          <Link href="/feed/digest.xml" className="btn btn-ghost h-7 px-2.5 mt-3">
            <Rss className="w-3.5 h-3.5" aria-hidden="true" /> Subscribe via RSS
          </Link>
        </Panel>
      </div>
    );
  }

  const data = latest.structuredJson as unknown as DigestData;
  const archive = recent.filter((r) => r.slug !== latest.slug);

  return (
    <div className="space-y-1.5">
      <DigestView
        title={latest.title}
        summary={latest.summary}
        date={latest.date}
        generatedBy={latest.generatedBy}
        data={data}
        actions={
          <Link href="/feed/digest.xml" className="btn btn-ghost h-7 px-2.5">
            <Rss className="w-3.5 h-3.5" aria-hidden="true" /> RSS feed
          </Link>
        }
      />

      <div className="grid gap-1.5 lg:grid-cols-2 items-start">
        <PersonalDigestPanel data={data} />

        {archive.length > 0 && (
          <Panel title="Archive" meta={`${archive.length} earlier editions`}>
            <ul>
              {archive.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/digest/${d.slug}`}
                    className="flex items-center justify-between gap-3 px-3 h-8 border-b border-border-subtle hover:bg-background-hover transition-colors group"
                  >
                    <span className="flex items-baseline gap-2.5 min-w-0">
                      <span className="num text-xs text-text-tertiary flex-none">{d.slug}</span>
                      <span className="text-sm text-text-secondary group-hover:text-accent-blue transition-colors truncate">
                        {d.title}
                      </span>
                    </span>
                    {d.stressBand && (
                      <span className="text-xs text-text-tertiary whitespace-nowrap">
                        stress <span className="num text-text-secondary">{d.stressScore ?? "—"}</span> {d.stressBand}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}

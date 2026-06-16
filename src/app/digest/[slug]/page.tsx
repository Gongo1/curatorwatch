import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getDigestBySlug } from "@/lib/digest/read";
import { DigestView } from "../DigestView";
import type { DigestData } from "@/lib/digest/types";

export const revalidate = 21600;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const digest = await getDigestBySlug(slug);
  if (!digest) return { title: "Digest not found — CuratorWatch" };
  return {
    title: `${digest.title} — Curator Daily`,
    description: digest.summary ?? "CuratorWatch nightly curator digest.",
  };
}

export default async function DigestSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const digest = await getDigestBySlug(slug);
  if (!digest || !digest.published) notFound();

  const data = digest.structuredJson as unknown as DigestData;

  return (
    <div className="max-w-[1000px]">
      <Link
        href="/digest"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-text-tertiary hover:text-accent-blue mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Curator Daily
      </Link>
      <DigestView
        title={digest.title}
        summary={digest.summary}
        date={digest.date}
        generatedBy={digest.generatedBy}
        data={data}
      />
    </div>
  );
}

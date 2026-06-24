import { AlertTriangle, ExternalLink } from "lucide-react";
import { getCuratorDisclosures } from "@/lib/curator-disclosures";

/**
 * Prominent banner for material off-chain disclosures (litigation, regulatory,
 * governance) that the Expected-Loss engine cannot price. Renders nothing when the
 * curator has no disclosures on record.
 */
export function CuratorDisclosureBanner({ address }: { address: string }) {
  const disclosures = getCuratorDisclosures(address);
  if (disclosures.length === 0) return null;

  return (
    <div className="mb-8 space-y-3">
      {disclosures.map((d, i) => (
        <div
          key={i}
          className="flex gap-3 rounded-2xl border border-accent-red/40 bg-accent-red/[0.06] p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-red" aria-hidden />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-accent-red">
                Disclosure
              </span>
              <span className="text-sm font-semibold text-text-primary">{d.title}</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">{d.detail}</p>
            <a
              href={d.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 font-mono text-xs text-text-tertiary hover:text-text-secondary"
            >
              {d.date} · {d.sourceTitle} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

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
    <section
      id="curator-disclosure"
      aria-label="Material disclosures"
      className="panel scroll-mt-24 border-accent-red-muted"
    >
      <div className="panel-head">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-accent-red" aria-hidden />
        <h2 className="panel-title text-accent-red">
          Disclosure{disclosures.length > 1 ? "s" : ""}
        </h2>
        <span className="panel-meta">off-chain · not priced in on-chain figures</span>
      </div>
      {disclosures.map((d, i) => (
        <div key={i} className="px-3 py-2.5 border-b border-border-subtle last:border-b-0">
          <div className="text-sm font-semibold text-text-primary">{d.title}</div>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary max-w-[110ch]">{d.detail}</p>
          <a
            href={d.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-accent-blue"
          >
            <span className="num">{d.date}</span> · {d.sourceTitle} <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      ))}
    </section>
  );
}

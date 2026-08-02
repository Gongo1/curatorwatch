/* Hallmark · component: news-list · genre: editorial · theme: Slate Terminal
 * states: default · hover · focus · active · disabled(n/a) · loading(n/a) · error(empty) · success
 * contrast: pass (46-50)
 */
import Link from "next/link";

export interface NewswireRow {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment?: string | null;
  category?: string | null;
  /** Shown only in the global "strip" variant (which curator the item is about). */
  curator?: { name: string; slug: string } | null;
}

interface NewswireProps {
  items: NewswireRow[];
  /** "rail" = narrow vertical list (curator page); "strip" = wider list with curator labels (home). */
  variant?: "rail" | "strip";
  title?: string;
  limit?: number;
  /** Optional "view all" target. */
  href?: string;
  emptyHint?: string;
}

/** Compact relative age: 2h · 5h · 1d · 3w · 4mo. */
function compactAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return `${Math.floor(d / 30)}mo`;
}

function sentimentDot(sentiment?: string | null): string {
  if (sentiment === "negative") return "bg-accent-red";
  if (sentiment === "positive") return "bg-accent-green";
  return "bg-text-muted";
}

export function Newswire({
  items,
  variant = "rail",
  title = "Newswire",
  limit,
  href,
  emptyHint = "No headlines naming this curator yet. We scan major crypto desks every few hours.",
}: NewswireProps) {
  const rows = limit ? items.slice(0, limit) : items;

  return (
    <section className="border border-border rounded-2xl bg-background-subtle overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border-subtle flex items-center justify-between gap-2">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-text-tertiary">{title}</span>
        <span className="font-mono text-[0.62rem] text-text-muted tabular-nums">{items.length}</span>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 font-mono text-xs text-text-tertiary leading-relaxed">{emptyHint}</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {rows.map((r) => (
            <li key={r.id}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block px-4 py-3 hover:bg-background-elevated/50 focus-visible:bg-background-elevated/50 focus-visible:outline-none transition-colors"
              >
                <div className="flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-text-tertiary">
                  <span className={`w-1.5 h-1.5 rounded-full flex-none ${sentimentDot(r.sentiment)}`} />
                  {variant === "strip" && r.curator && (
                    <>
                      <span className="text-text-secondary normal-case tracking-normal font-medium truncate max-w-[40%]">
                        {r.curator.name}
                      </span>
                      <span className="text-text-muted">·</span>
                    </>
                  )}
                  <span className="truncate">{r.source}</span>
                  <span className="text-text-muted">·</span>
                  <time dateTime={r.publishedAt} className="tabular-nums flex-none">
                    {compactAge(r.publishedAt)}
                  </time>
                  {r.category === "incident" && (
                    <span className="text-accent-red flex-none ml-auto">incident</span>
                  )}
                </div>
                <p className="text-sm text-text-primary group-hover:text-accent-blue transition-colors mt-1 leading-snug line-clamp-2">
                  {r.title}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}

      {href && items.length > 0 && (
        <Link
          href={href}
          className="block px-4 py-2.5 border-t border-border-subtle font-mono text-[0.62rem] uppercase tracking-[0.08em] text-accent-blue hover:bg-background-elevated/50 transition-colors"
        >
          View all →
        </Link>
      )}
    </section>
  );
}

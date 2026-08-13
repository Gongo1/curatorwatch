import Link from "next/link";
import type { StressBand } from "@/lib/stress-index";
import { BAND_STYLE } from "@/lib/stress-band-style";
import { stressTrendBlurb, type StressPoint } from "@/lib/stress-trend";

// Homepage stress module: today's Curator Stress Index, a 7-day line, and the
// deterministic trend blurb. Data is the nightly digest's stored readings —
// server-fetched, ISR-cached with the page; no client fetch.

const W = 260;
const H = 64;
const PAD_X = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 10;
const BAND_EDGES = [20, 40, 60, 80];

function fmtSlug(slug: string): string {
  const [, m, d] = slug.split("-").map(Number);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m && d ? `${MONTHS[m - 1]} ${d}` : slug;
}

export function StressStrip({
  points,
  drivers,
}: {
  points: StressPoint[];
  drivers: string[];
}) {
  if (points.length === 0) return null;
  const last = points[points.length - 1];
  const band = (last.band as StressBand) in BAND_STYLE ? (last.band as StressBand) : "Calm";

  // Zoomed y-domain (padded, clamped to 0–100) — explicit min/max labels below
  // keep the zoom honest; the chip carries the absolute level.
  const scores = points.map((p) => p.score);
  const lo = Math.max(0, Math.floor(Math.min(...scores)) - 6);
  const hi = Math.min(100, Math.ceil(Math.max(...scores)) + 6);
  const y = (v: number) =>
    PAD_TOP + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - PAD_TOP - PAD_BOTTOM);
  const x = (i: number) =>
    points.length === 1
      ? W / 2
      : PAD_X + (i / (points.length - 1)) * (W - 2 * PAD_X);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  const edges = BAND_EDGES.filter((e) => e > lo && e < hi);

  return (
    <div className="grid sm:grid-cols-[auto_auto_1fr] gap-x-8 gap-y-4 items-center rounded-2xl border border-border bg-background-subtle px-5 py-4 mb-6">
      <div>
        <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary">
          Curator stress index
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="font-mono font-bold text-3xl tabular-nums">{Math.round(last.score)}</span>
          <span className={`font-mono text-xs border rounded-md px-2 py-0.5 ${BAND_STYLE[band]}`}>
            {band}
          </span>
        </div>
      </div>

      {points.length >= 2 ? (
        <div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            className="max-w-full"
            role="img"
            aria-label={`Curator stress index, last ${points.length} days: ${points
              .map((p) => Math.round(p.score))
              .join(", ")}`}
          >
            {/* Band boundaries inside the zoomed domain — recessive, labeled */}
            {edges.map((e) => (
              <g key={e}>
                <line
                  x1={PAD_X}
                  x2={W - PAD_X}
                  y1={y(e)}
                  y2={y(e)}
                  stroke="var(--border)"
                  strokeDasharray="3 4"
                  strokeWidth="1"
                />
                <text x={W - PAD_X} y={y(e) - 2} textAnchor="end" fontSize="8" fill="var(--text-muted)" fontFamily="ui-monospace,monospace">
                  {e}
                </text>
              </g>
            ))}
            <path d={path} fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <g key={p.slug}>
                {i === points.length - 1 && (
                  <circle cx={x(i)} cy={y(p.score)} r="3.5" fill="var(--accent-blue)" />
                )}
                {/* Oversized invisible hit target; native SVG tooltip */}
                <circle cx={x(i)} cy={y(p.score)} r="9" fill="transparent">
                  <title>{`${fmtSlug(p.slug)} · ${Math.round(p.score)} · ${p.band}`}</title>
                </circle>
              </g>
            ))}
          </svg>
          <div className="flex justify-between font-mono text-[0.6rem] text-text-muted px-1">
            <span>{fmtSlug(points[0].slug)}</span>
            <span>
              range {Math.round(Math.min(...scores))}–{Math.round(Math.max(...scores))}
            </span>
            <span>{fmtSlug(last.slug)}</span>
          </div>
        </div>
      ) : (
        <div className="font-mono text-xs text-text-tertiary">7-day line appears as nightly readings accumulate.</div>
      )}

      <div className="min-w-0">
        <p className="text-sm leading-relaxed text-text-secondary">
          {stressTrendBlurb(points, drivers)}
        </p>
        <Link href="/digest" className="font-mono text-xs text-accent-blue mt-1 inline-block">
          From the Curator Daily →
        </Link>
      </div>
    </div>
  );
}

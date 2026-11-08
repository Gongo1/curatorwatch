import Link from "next/link";
import type { StressBand } from "@/lib/stress-index";
import { BAND_STYLE } from "@/lib/stress-band-style";
import { stressTrendBlurb, type StressPoint } from "@/lib/stress-trend";

// Homepage stress module: today's Curator Stress Index, a 7-day line, and the
// deterministic trend blurb. Data is the nightly digest's stored readings —
// server-fetched, ISR-cached with the page; no client fetch.

const W = 320;
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
    <div className="p-3">
      <div className="flex items-baseline gap-3">
        <span className="num font-semibold text-[2rem] leading-none text-text-primary">{Math.round(last.score)}</span>
        <span className={`label border px-1.5 py-0.5 ${BAND_STYLE[band]}`}>{band}</span>
        <span className="ml-auto label normal-case tracking-normal font-normal num">
          {fmtSlug(last.slug)}
        </span>
      </div>

      {points.length >= 2 ? (
        <div className="mt-2.5">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto block"
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
                  strokeDasharray="2 3"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <text x={PAD_X} y={y(e) - 2} fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-mono)">
                  {e}
                </text>
              </g>
            ))}
            <path
              d={path}
              fill="none"
              stroke="var(--accent-blue)"
              strokeWidth="1.75"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {points.map((p, i) => (
              <g key={p.slug}>
                {i === points.length - 1 && (
                  <rect x={x(i) - 2.5} y={y(p.score) - 2.5} width="5" height="5" fill="var(--accent-blue)" />
                )}
                {/* Oversized invisible hit target; native SVG tooltip */}
                <circle cx={x(i)} cy={y(p.score)} r="9" fill="transparent">
                  <title>{`${fmtSlug(p.slug)} · ${Math.round(p.score)} · ${p.band}`}</title>
                </circle>
              </g>
            ))}
          </svg>
          <div className="flex justify-between num text-[0.65rem] text-text-muted mt-1">
            <span>{fmtSlug(points[0].slug)}</span>
            <span>
              range {Math.round(Math.min(...scores))}–{Math.round(Math.max(...scores))}
            </span>
            <span>{fmtSlug(last.slug)}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-text-tertiary mt-2">The 7-day line appears as nightly readings accumulate.</p>
      )}

      <p className="text-[0.85rem] leading-relaxed text-text-secondary mt-2.5">
        {stressTrendBlurb(points, drivers)}
      </p>
      <Link href="/digest" className="label text-accent-blue hover:underline mt-2 inline-block">
        Read the Curator Daily
      </Link>
    </div>
  );
}

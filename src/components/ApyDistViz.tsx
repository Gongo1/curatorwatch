export interface ApyDistribution {
  count: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  p95: number;
  max: number;
  histEdges: number[];
  histogram: number[];
  histogramTvl: number[];
}

/**
 * Build the product-standard APY distribution from (apy %, tvl $) pairs —
 * same bands as the ecosystem-wide one in dashboard-queries, so every
 * histogram in the product reads the same way.
 */
export function buildApyDistribution(
  pairs: { apy: number; tvl: number }[]
): ApyDistribution {
  const sorted = [...pairs].sort((a, b) => a.apy - b.apy);
  const values = sorted.map((p) => p.apy);
  const at = (q: number) =>
    values.length ? values[Math.min(values.length - 1, Math.floor(q * values.length))] : 0;

  const histEdges = [0, 2, 4, 6, 8, 10, 15, 100];
  const histogram = new Array(histEdges.length - 1).fill(0);
  const histogramTvl = new Array(histEdges.length - 1).fill(0);
  for (const { apy, tvl } of pairs) {
    for (let i = 0; i < histEdges.length - 1; i++) {
      if (apy >= histEdges[i] && (apy < histEdges[i + 1] || i === histEdges.length - 2)) {
        histogram[i]++;
        histogramTvl[i] += tvl;
        break;
      }
    }
  }
  return {
    count: values.length,
    min: values[0] ?? 0,
    q1: at(0.25),
    median: at(0.5),
    q3: at(0.75),
    p95: at(0.95),
    max: values[values.length - 1] ?? 0,
    histEdges,
    histogram,
    histogramTvl,
  };
}

// Net-APY spread across curated vaults — a histogram beats an average: it shows
// the cluster and the high-yield tail. Bar height = vault count (shape), bar
// brightness = $ concentration. The product-wide way to show a yield range.
export function ApyDistViz({
  d,
  label,
  tall = false,
}: {
  d: ApyDistribution;
  label?: string;
  tall?: boolean;
}) {
  const maxCount = Math.max(1, ...d.histogram);
  const maxTvl = Math.max(1, ...d.histogramTvl);
  const fmtM = (n: number) =>
    n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${Math.round(n / 1e6)}M`;
  return (
    <div className="min-w-[190px]">
      <div className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-text-tertiary">
        {label ?? `Net APY · ${d.count} vaults`}
      </div>
      <div
        className={`flex items-end gap-[3px] mt-1.5 ${tall ? "h-14" : "h-7"}`}
        aria-hidden="true"
      >
        {d.histogram.map((c, i) => (
          <div
            key={i}
            className="flex-1 rounded-[2px] min-w-[6px] bg-accent-blue"
            style={{
              height: `${Math.max(10, (c / maxCount) * 100)}%`,
              opacity: 0.22 + 0.78 * (d.histogramTvl[i] / maxTvl),
            }}
            title={`${d.histEdges[i]}–${d.histEdges[i + 1] >= 100 ? "∞" : d.histEdges[i + 1]}%: ${c} vault${c === 1 ? "" : "s"} · ${fmtM(d.histogramTvl[i])}`}
          />
        ))}
      </div>
      {/* Minimal x-axis: a tick + APY % at each bin's lower edge (aligns to bar starts). */}
      <div className="flex gap-[3px] mt-1" aria-hidden="true">
        {d.histEdges.slice(0, -1).map((edge, i) => (
          <div key={i} className="flex-1 min-w-[6px]">
            <span className="block w-px h-1 bg-border" />
            <span className="block font-mono text-[0.55rem] leading-none text-text-muted tabular-nums mt-0.5">
              {edge}
              {i === d.histEdges.length - 2 ? "+" : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="font-mono text-[0.62rem] text-text-tertiary mt-1.5 tabular-nums">
        median <span className="text-text-secondary">{d.median.toFixed(1)}%</span> · 95th{" "}
        <span className="text-text-secondary">{Math.round(d.p95)}%</span> · shade = TVL
      </div>
    </div>
  );
}

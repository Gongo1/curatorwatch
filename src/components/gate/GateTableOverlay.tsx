"use client";

import { useEffect, useRef } from "react";
import { useGate } from "@/lib/gate/GateProvider";
import { trackGate } from "@/lib/gate/track";
import { FREE_RANKING_ROWS } from "@/lib/gate/config";

// The locked continuation of the curator ranking. Six decoy rows that are
// pixel-identical in geometry to real rows (same grid, avatar, type scale) but
// carry NO data — anonymous payloads genuinely stop at the free window; these
// are pure decoration. Static blur, no shimmer: shimmer reads as "loading",
// static reads as "locked".

const DECOY_WIDTHS = [96, 118, 74, 108, 84, 122]; // deterministic — no hydration drift

export function GateTableOverlay({
  totalCount,
  teaseNames,
}: {
  totalCount: number;
  teaseNames: string[];
}) {
  const { openGate } = useGate();
  const seen = useRef(false);

  useEffect(() => {
    if (!seen.current) {
      seen.current = true;
      trackGate("gate_impression", { surface: "table" });
    }
  }, []);

  const remaining = Math.max(0, totalCount - FREE_RANKING_ROWS);
  const tease =
    teaseNames.length > 0
      ? `${teaseNames.slice(0, 2).join(", ")} + ${remaining - Math.min(2, teaseNames.length)} more`
      : `${remaining} more curators`;

  return (
    <div className="relative">
      {/* Decoy rows under a static blur, fading out into the overlay card */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none"
        style={{
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,.7), transparent 92%)",
          WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,.7), transparent 92%)",
        }}
      >
        {DECOY_WIDTHS.map((w, i) => (
          <div
            key={i}
            className="grid grid-cols-[34px_1fr_96px_132px] gap-4 items-center px-3 py-3 border-t border-border-subtle blur-[5px] opacity-55"
          >
            <span className="font-mono text-sm text-text-tertiary text-right tabular-nums">
              {FREE_RANKING_ROWS + 1 + i}
            </span>
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-[9px] flex-none bg-background-elevated border border-border" />
              <span
                className="h-3.5 rounded bg-background-elevated"
                style={{ width: w }}
              />
            </div>
            <span className="hidden sm:block h-3 w-6 justify-self-end rounded bg-background-elevated" />
            <span className="h-3.5 w-16 justify-self-end rounded bg-background-elevated" />
          </div>
        ))}
      </div>

      {/* Overlay card */}
      <div className="absolute inset-x-0 top-10 flex justify-center">
        <button
          type="button"
          onClick={() => openGate("table")}
          className="rounded-2xl border border-border bg-background-elevated/90 backdrop-blur-md px-6 py-5 text-center shadow-2xl hover:border-accent-blue transition-colors max-w-sm"
        >
          <div className="font-display font-bold text-base text-text-primary">
            {tease}
          </div>
          <div className="mt-1 text-sm text-text-secondary">
            The full ranking — searchable, sortable, free.
          </div>
          <div className="mt-3 inline-block rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-background">
            Unlock the full table
          </div>
        </button>
      </div>
    </div>
  );
}

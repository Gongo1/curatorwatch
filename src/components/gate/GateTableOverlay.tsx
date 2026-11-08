"use client";

import { useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { useGate } from "@/lib/gate/GateProvider";
import { trackGate } from "@/lib/gate/track";
import { FREE_RANKING_ROWS } from "@/lib/gate/config";
import { RANKING_COLS } from "@/components/curators/ranking-cols";

// The locked continuation of the curator ranking: decoy rows in the real
// row geometry carrying NO data (anonymous payloads genuinely stop at the
// free window), dimmed under a static blur, with the sign-up panel docked on
// top. Static, not shimmering: shimmer reads as "loading", static as "locked".

const DECOY_WIDTHS = [96, 118, 74, 108, 84, 122, 90]; // deterministic — no hydration drift

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
      ? `${teaseNames.slice(0, 2).join(", ")} and ${remaining - Math.min(2, teaseNames.length)} more`
      : `${remaining} more curators`;

  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none select-none opacity-50 blur-[3px]">
        {DECOY_WIDTHS.map((w, i) => (
          <div key={i} className={`${RANKING_COLS} gap-3 items-center px-3 h-[1.875rem] border-b border-border-subtle`}>
            <span className="num text-xs text-text-tertiary text-right">{FREE_RANKING_ROWS + 1 + i}</span>
            <span className="flex items-center gap-2.5">
              <span className="w-5 h-5 bg-background-elevated" />
              <span className="h-2.5 bg-background-hover" style={{ width: w }} />
            </span>
            <span className="hidden md:block h-2.5 w-5 justify-self-end bg-background-hover" />
            <span className="hidden xl:block h-2.5 w-8 justify-self-end bg-background-hover" />
            <span className="hidden sm:block h-2.5 w-9 justify-self-end bg-background-hover" />
            <span className="hidden xl:block h-2.5 w-7 justify-self-end bg-background-hover" />
            <span className="h-2.5 w-16 justify-self-end bg-background-hover" />
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-3">
        <div className="w-full max-w-[26rem] bg-background-subtle border border-accent-blue shadow-[0_16px_40px_-12px_oklch(0%_0_0/0.8)]">
          <div className="panel-head">
            <Lock className="w-3.5 h-3.5 text-accent-blue" aria-hidden="true" />
            <span className="panel-title">{remaining} more curators</span>
          </div>
          <div className="p-3.5">
            <p className="text-sm text-text-primary">
              {tease}. Sort, filter, and open every profile with a free account.
            </p>
            <p className="label mt-1.5 normal-case tracking-normal font-normal">
              Email and a 6-digit code. No password, no card.
            </p>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={() => openGate("table")} className="btn btn-primary flex-1">
                Create free account
              </button>
              <button type="button" onClick={() => openGate("signin")} className="btn btn-ghost">
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

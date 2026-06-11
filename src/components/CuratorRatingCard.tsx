"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { CuratorEngineRating } from "@/lib/curator-engine-rating";
import { gradeColor, fmtBps, GRADE_BLURB } from "@/lib/grade-style";
import { CuratorEngineGrade } from "@/components/CuratorEngineGrade";

// Compact, clickable rating card that sits beside the TVL card. Click → a
// front-and-center modal with the full breakdown.
export function CuratorRatingCard({ rating }: { rating: CuratorEngineRating }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-full w-full flex-col rounded-2xl border border-border bg-background-subtle p-5 text-left transition-colors hover:border-text-tertiary"
      >
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary">
          CuratorWatch Rating
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold normal-case tracking-normal text-amber-400">Beta</span>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border font-display text-3xl font-bold ${gradeColor(rating.grade)}`}>
            {rating.grade}
          </span>
          <div className="min-w-0">
            <div className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{fmtBps(rating.elMedian)}</div>
            <div className="font-mono text-xs text-text-tertiary">expected loss / yr · {rating.confidence.toLowerCase()} confidence</div>
          </div>
        </div>
        <p className="mt-3 font-mono text-xs leading-relaxed text-text-secondary">{GRADE_BLURB[rating.grade]}</p>
        <span className="mt-auto pt-3 font-mono text-xs text-accent-blue group-hover:underline">View breakdown →</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-[560px] max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-text-tertiary hover:bg-background-subtle hover:text-text-primary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="p-5">
              <CuratorEngineGrade rating={rating} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

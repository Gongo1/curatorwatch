import type { StressBand } from "@/lib/stress-index";

/** Product-standard band chip classes — shared by the /digest page and the
 *  home stress strip so a band always wears the same color + printed label.
 *  Terminal chip: square hairline in the band color, no fill. */
export const BAND_STYLE: Record<StressBand, string> = {
  Calm: "border text-accent-green border-accent-green/60",
  Normal: "border text-accent-green border-accent-green/60",
  Elevated: "border text-accent-yellow border-accent-yellow/60",
  Stressed: "border text-accent-yellow border-accent-yellow/60",
  Critical: "border text-accent-red border-accent-red/60",
};

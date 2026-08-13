import type { StressBand } from "@/lib/stress-index";

/** Product-standard band chip classes — shared by the /digest page and the
 *  home stress strip so a band always wears the same color + printed label. */
export const BAND_STYLE: Record<StressBand, string> = {
  Calm: "text-accent-green border-accent-green/40 bg-accent-green/10",
  Normal: "text-accent-green border-accent-green/40 bg-accent-green/10",
  Elevated: "text-accent-yellow border-accent-yellow/40 bg-accent-yellow/10",
  Stressed: "text-accent-yellow border-accent-yellow/40 bg-accent-yellow/10",
  Critical: "text-accent-red border-accent-red/40 bg-accent-red/10",
};

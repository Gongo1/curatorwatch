import { Flag } from "lucide-react";

/**
 * Shown next to a curator's name when the curator has a material disclosure
 * (litigation / regulatory / governance); points the reader to the disclosure.
 *
 * - "sm": compact pill for tables, directory cards, and comparison columns. Renders a
 *   plain <span> (these contexts are already wrapped in a link to the profile).
 * - "lg": badge-sized tile for the curator profile.
 */
export function DisclosureFlag({ size = "sm" }: { size?: "sm" | "lg" }) {
  if (size === "lg") {
    return (
      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-red-500/40 bg-red-500/10 text-red-400">
        <Flag className="h-7 w-7" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wide">Flagged</span>
      </div>
    );
  }
  return (
    <span
      title="Material disclosure — see curator profile."
      className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-400"
    >
      <Flag className="h-3 w-3" aria-hidden /> Flagged
    </span>
  );
}

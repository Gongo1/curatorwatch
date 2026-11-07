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
      <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 border border-accent-red-muted bg-accent-red/10 text-accent-red">
        <Flag className="h-7 w-7" aria-hidden />
        <span className="label text-accent-red">Flagged</span>
      </div>
    );
  }
  return (
    <span
      title="Material disclosure — see curator profile."
      className="label inline-flex flex-none items-center gap-1 border border-accent-red-muted px-1 py-0.5 text-accent-red"
    >
      <Flag className="h-2.5 w-2.5" aria-hidden /> Flagged
    </span>
  );
}

import { NOT_COUNTED_LABELS, type VaultCountingStatus } from "@/lib/data-quality/counting";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Inline note for a vault row that is visible but left out of totals, plus a
 * "stale since" badge when its data stopped updating. Renders nothing for a
 * counted vault.
 */
export function NotCountedNote({ counting }: { counting?: VaultCountingStatus | null }) {
  if (!counting || counting.counted || !counting.reason) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[0.75rem] text-text-tertiary">
      {counting.staleSince && (
        <span className="label text-accent-yellow border border-accent-yellow/40 px-1 py-px">
          Stale since <span className="num normal-case tracking-normal font-normal">{fmtDate(counting.staleSince)}</span>
        </span>
      )}
      <span>Not counted in totals: {NOT_COUNTED_LABELS[counting.reason]}</span>
    </span>
  );
}

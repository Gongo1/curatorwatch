import { Tooltip } from "./Tooltip";

export function VaultGradeBadge({ grade, failures }: { grade?: string | null; failures?: string[] }) {
  if (!grade) return null;

  const badge = (() => {
    if (grade === "high-grade") {
      return (
        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-green/10 text-accent-green border border-accent-green/20">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          High
        </span>
      );
    }

    if (grade === "medium-grade") {
      return (
        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Med
        </span>
      );
    }

    // low-grade
    return (
      <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-red/10 text-accent-red border border-accent-red/20">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Low
      </span>
    );
  })();

  // If failures provided, wrap in tooltip
  if (failures && failures.length > 0) {
    return (
      <Tooltip
        content={
          <ul className="space-y-0.5 text-left">
            {failures.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        }
        position="bottom"
      >
        {badge}
      </Tooltip>
    );
  }

  if (failures && failures.length === 0 && grade === "high-grade") {
    return (
      <Tooltip content="Passes all 9 requirements" position="bottom">
        {badge}
      </Tooltip>
    );
  }

  return badge;
}

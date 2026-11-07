import { Tooltip } from "./Tooltip";

export function MorphoVerifiedBadge({ listed }: { listed?: boolean }) {
  if (listed !== true) return null;

  const badge = (
    <span
      role="img"
      aria-label="Listed by Morpho"
      className="ml-1 inline-flex items-center justify-center w-4 h-4 border border-border-strong text-accent-blue"
    >
      <svg
        className="w-2.5 h-2.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="square" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );

  return (
    <Tooltip
      content="Listed and verified by Morpho governance"
      position="bottom"
    >
      {badge}
    </Tooltip>
  );
}

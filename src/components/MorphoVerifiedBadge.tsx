import { Tooltip } from "./Tooltip";

export function MorphoVerifiedBadge({ listed }: { listed?: boolean }) {
  if (listed !== true) return null;

  const badge = (
    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded border text-accent-blue bg-accent-blue/10 border-accent-blue/20">
      <svg
        className="w-2.5 h-2.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M5 13l4 4L19 7"
        />
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

/**
 * Colored pill badge showing network/chain name.
 * Used on curator tables, vault lists, and detail pages.
 */

const NETWORK_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  ethereum: { bg: "bg-slate-500/15 border-slate-500/30", text: "text-slate-400", label: "Ethereum" },
  katana: { bg: "bg-red-500/15 border-red-500/30", text: "text-red-400", label: "Katana" },
  arbitrum: { bg: "bg-blue-500/15 border-blue-500/30", text: "text-blue-400", label: "Arbitrum" },
  avalanche: { bg: "bg-rose-500/15 border-rose-500/30", text: "text-rose-400", label: "Avalanche" },
  polygon: { bg: "bg-purple-500/15 border-purple-500/30", text: "text-purple-400", label: "Polygon" },
  base: { bg: "bg-blue-400/15 border-blue-400/30", text: "text-blue-300", label: "Base" },
  optimism: { bg: "bg-red-400/15 border-red-400/30", text: "text-red-300", label: "Optimism" },
  scroll: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", label: "Scroll" },
  "bnb chain": { bg: "bg-yellow-500/15 border-yellow-500/30", text: "text-yellow-400", label: "BNB Chain" },
  monad: { bg: "bg-indigo-500/15 border-indigo-500/30", text: "text-indigo-400", label: "Monad" },
  plasma: { bg: "bg-teal-500/15 border-teal-500/30", text: "text-teal-400", label: "Plasma" },
};

const DEFAULT_STYLE = { bg: "bg-gray-500/15 border-gray-500/30", text: "text-gray-400" };

interface NetworkBadgeProps {
  network: string;
  size?: "sm" | "md";
}

export function NetworkBadge({ network, size = "sm" }: NetworkBadgeProps) {
  const key = network.toLowerCase();
  const style = NETWORK_STYLES[key] ?? DEFAULT_STYLE;
  const label = NETWORK_STYLES[key]?.label ?? network;

  const sizeClasses = size === "sm"
    ? "px-1.5 py-0.5 text-[10px]"
    : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded border font-medium ${style.bg} ${style.text} ${sizeClasses}`}
    >
      {label}
    </span>
  );
}

interface NetworkBadgeListProps {
  networks: string[];
  size?: "sm" | "md";
}

export function NetworkBadgeList({ networks, size = "sm" }: NetworkBadgeListProps) {
  if (networks.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {networks.map((n) => (
        <NetworkBadge key={n} network={n} size={size} />
      ))}
    </div>
  );
}

/**
 * Square hairline tag showing network/chain name.
 * Used on curator tables, vault lists, and detail pages.
 */

const NETWORK_LABELS: Record<string, string> = {
  ethereum: "Ethereum",
  katana: "Katana",
  arbitrum: "Arbitrum",
  avalanche: "Avalanche",
  polygon: "Polygon",
  base: "Base",
  optimism: "Optimism",
  scroll: "Scroll",
  "bnb chain": "BNB Chain",
  monad: "Monad",
  plasma: "Plasma",
  unichain: "Unichain",
  berachain: "Berachain",
  hyperevm: "HyperEVM",
  tac: "TAC",
  linea: "Linea",
  gnosis: "Gnosis",
  sonic: "Sonic",
  mantle: "Mantle",
  ink: "Ink",
  swell: "Swell",
  metis: "Metis",
  "x layer": "X Layer",
};

interface NetworkBadgeProps {
  network: string;
  size?: "sm" | "md";
}

export function NetworkBadge({ network, size = "sm" }: NetworkBadgeProps) {
  const label = NETWORK_LABELS[network.toLowerCase()] ?? network;

  const sizeClasses = size === "sm"
    ? "h-[1.15rem] px-1 text-[10px]"
    : "h-[1.35rem] px-1.5";

  return (
    <span
      className={`label inline-flex items-center border border-border-strong text-text-secondary whitespace-nowrap ${sizeClasses}`}
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

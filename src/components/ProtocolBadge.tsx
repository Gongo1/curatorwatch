/**
 * Square hairline tag showing protocol name.
 * Used on curator tables, vault lists, and detail pages.
 */

const PROTOCOL_LABELS: Record<string, string> = {
  morpho: "Morpho",
  aave: "Aave",
  euler: "Euler",
  compound: "Compound",
  spark: "Spark",
  fluid: "Fluid",
  yearn: "Yearn",
  pendle: "Pendle",
  silo: "Silo",
  maker: "Maker",
  sky: "Sky",
  gearbox: "Gearbox",
  instadapp: "Instadapp",
  katana: "Katana",
  midas: "Midas",
  termmax: "TermMax",
  lido: "Lido",
  sierra: "Sierra",
  acre: "Acre",
  falcon: "Falcon",
  telosc: "TelosC",
  mfarm: "mFARM",
  trevee: "Trevee",
  "9summits": "9Summits",
  re7: "Re7",
  k3: "K3",
};

interface ProtocolBadgeProps {
  protocol: string;
  size?: "sm" | "md";
}

export function ProtocolBadge({ protocol, size = "sm" }: ProtocolBadgeProps) {
  const label = PROTOCOL_LABELS[protocol.toLowerCase()] ?? protocol;

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

interface ProtocolBadgeListProps {
  protocols: string[];
  size?: "sm" | "md";
}

export function ProtocolBadgeList({ protocols, size = "sm" }: ProtocolBadgeListProps) {
  if (protocols.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {protocols.map((p) => (
        <ProtocolBadge key={p} protocol={p} size={size} />
      ))}
    </div>
  );
}

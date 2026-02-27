/**
 * Colored pill badge showing protocol name.
 * Used on curator tables, vault lists, and detail pages.
 */

const PROTOCOL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  morpho: { bg: "bg-blue-500/15 border-blue-500/30", text: "text-blue-400", label: "Morpho" },
  aave: { bg: "bg-purple-500/15 border-purple-500/30", text: "text-purple-400", label: "Aave" },
  euler: { bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-400", label: "Euler" },
  compound: { bg: "bg-green-500/15 border-green-500/30", text: "text-green-400", label: "Compound" },
  spark: { bg: "bg-orange-500/15 border-orange-500/30", text: "text-orange-400", label: "Spark" },
  fluid: { bg: "bg-cyan-500/15 border-cyan-500/30", text: "text-cyan-400", label: "Fluid" },
  yearn: { bg: "bg-blue-400/15 border-blue-400/30", text: "text-blue-300", label: "Yearn" },
  pendle: { bg: "bg-indigo-500/15 border-indigo-500/30", text: "text-indigo-400", label: "Pendle" },
  silo: { bg: "bg-amber-500/15 border-amber-500/30", text: "text-amber-400", label: "Silo" },
  maker: { bg: "bg-teal-500/15 border-teal-500/30", text: "text-teal-400", label: "Maker" },
  sky: { bg: "bg-sky-500/15 border-sky-500/30", text: "text-sky-400", label: "Sky" },
  gearbox: { bg: "bg-red-500/15 border-red-500/30", text: "text-red-400", label: "Gearbox" },
  instadapp: { bg: "bg-pink-500/15 border-pink-500/30", text: "text-pink-400", label: "Instadapp" },
};

const DEFAULT_STYLE = { bg: "bg-gray-500/15 border-gray-500/30", text: "text-gray-400" };

interface ProtocolBadgeProps {
  protocol: string;
  size?: "sm" | "md";
}

export function ProtocolBadge({ protocol, size = "sm" }: ProtocolBadgeProps) {
  const style = PROTOCOL_STYLES[protocol.toLowerCase()] ?? DEFAULT_STYLE;
  const label = PROTOCOL_STYLES[protocol.toLowerCase()]?.label ?? protocol;

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

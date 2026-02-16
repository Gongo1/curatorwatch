/**
 * Format a large number as currency with appropriate suffix
 * 1234567.89 → "$1.23M"
 * 123456.78 → "$123.46K"
 * 1234.56 → "$1,234.56"
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";

  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (absValue >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (absValue >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Format a decimal as percentage
 * 0.0567 → "5.67%"
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Truncate an Ethereum address
 * "0x1234567890abcdef..." → "0x1234...cdef"
 */
export function formatAddress(address: string | null | undefined): string {
  if (!address) return "-";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format a timestamp as relative time
 * "Updated 30s ago", "Updated 5m ago"
 */
export function formatTimeAgo(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return "Never";

  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Format a date as readable string
 * "Jan 15, 2026"
 */
export function formatDate(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return "-";

  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format token amount with symbol
 * formatTokenAmount("32500000000000", 6, "USDC") → "32.5M USDC"
 */
export function formatTokenAmount(
  value: string | number | null | undefined,
  decimals: number,
  symbol?: string
): string {
  if (value === null || value === undefined) return "-";

  const numValue = typeof value === "string" ? Number(value) : value;
  const normalized = numValue / Math.pow(10, decimals);

  let formatted: string;
  if (normalized >= 1_000_000_000) {
    formatted = `${(normalized / 1_000_000_000).toFixed(2)}B`;
  } else if (normalized >= 1_000_000) {
    formatted = `${(normalized / 1_000_000).toFixed(2)}M`;
  } else if (normalized >= 1_000) {
    formatted = `${(normalized / 1_000).toFixed(2)}K`;
  } else {
    formatted = normalized.toFixed(2);
  }

  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Format adapter type for display
 * "MorphoMarketV1Adapter" → "Morpho Market V1"
 */
export function formatAdapterType(type: string | null | undefined): string {
  if (!type) return "Unknown";

  // Handle common types
  if (type === "MetaMorpho") return "MetaMorpho";
  if (type.includes("MorphoMarket")) return "Morpho Market";

  // Generic formatting: add spaces before capitals
  return type
    .replace(/([A-Z])/g, " $1")
    .replace(/Adapter$/i, "")
    .trim();
}

/**
 * Format share price with more precision
 * 1.0234567 → "1.0235"
 */
export function formatSharePrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return value.toFixed(4);
}

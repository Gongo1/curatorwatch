// Terminal functions: every top-level page has a mnemonic code. The function
// bar lists the numbered ones (keys 1–8 jump there); the command line accepts
// any code or label. Portfolio joins only when its flag is on.

export interface TerminalFunction {
  code: string;
  label: string;
  href: string;
  /** Number-key shortcut shown in the function bar. */
  key?: string;
  /** Extra words the command line matches on. */
  aliases?: string[];
}

const PORTFOLIO_ON = process.env.NEXT_PUBLIC_FEATURE_PORTFOLIO === "true";

export const FUNCTIONS: TerminalFunction[] = [
  { code: "CW", label: "Curators", href: "/", key: "1", aliases: ["home", "ranking", "market"] },
  { code: "CMP", label: "Compare", href: "/compare", key: "2", aliases: ["side by side"] },
  { code: "YLD", label: "Yields", href: "/yields", key: "3", aliases: ["apy", "yield"] },
  { code: "FEE", label: "Fees", href: "/fees", key: "4", aliases: ["revenue"] },
  { code: "LIQ", label: "Liquidations", href: "/liquidations", key: "5", aliases: ["bad debt"] },
  { code: "CALC", label: "LP Calculator", href: "/calculator", key: "6", aliases: ["calculator", "return"] },
  { code: "DLY", label: "Curator Daily", href: "/digest", key: "7", aliases: ["digest", "stress", "daily"] },
  { code: "ALRT", label: "Alerts", href: "/alerts", key: "8", aliases: ["email", "notify", "changes", "activity"] },
  ...(PORTFOLIO_ON
    ? [{ code: "PORT", label: "Portfolio", href: "/portfolio", aliases: ["wallet"] }]
    : []),
  { code: "LOG", label: "Changelog", href: "/changelog", aliases: ["release notes", "updates"] },
  { code: "HELP", label: "Docs", href: "/docs", aliases: ["help", "methodology", "glossary"] },
];

/** Codes for detail routes (not in the bar, but tagged on the page title). */
const DETAIL_CODES: { prefix: string; code: string }[] = [
  { prefix: "/curator/", code: "CUR" },
  { prefix: "/vault/", code: "VLT" },
  { prefix: "/digest/", code: "DLY" },
];

export function functionForPath(pathname: string): TerminalFunction | null {
  if (pathname === "/") return FUNCTIONS[0];
  return FUNCTIONS.find((f) => f.href !== "/" && pathname.startsWith(f.href)) ?? null;
}

export function codeForPath(pathname: string): string | null {
  const detail = DETAIL_CODES.find((d) => pathname.startsWith(d.prefix));
  if (detail) return detail.code;
  return functionForPath(pathname)?.code ?? null;
}

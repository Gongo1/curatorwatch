/**
 * Extracts protocol name from Turtle opportunity description field.
 * Examples:
 *   "Morpho ... vault on Base" -> "morpho"
 *   "Lend USDC on Aave V3" -> "aave"
 *   "Euler vault..." -> "euler"
 */

const PROTOCOL_PATTERNS: [RegExp, string][] = [
  [/\bmorpho\b/i, "morpho"],
  [/\baave\b/i, "aave"],
  [/\beuler\b/i, "euler"],
  [/\bcompound\b/i, "compound"],
  [/\bspark\b/i, "spark"],
  [/\bfluid\b/i, "fluid"],
  [/\bsilo\b/i, "silo"],
  [/\byearn\b/i, "yearn"],
  [/\bpendle\b/i, "pendle"],
  [/\bgearbox\b/i, "gearbox"],
  [/\bmaker\b/i, "maker"],
  [/\bsky\b/i, "sky"],
  [/\binstadapp\b/i, "instadapp"],
];

export function extractProtocol(
  description: string,
  name?: string
): string {
  const text = `${description} ${name ?? ""}`;

  for (const [pattern, protocol] of PROTOCOL_PATTERNS) {
    if (pattern.test(text)) {
      return protocol;
    }
  }

  return "unknown";
}

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
  [/\bkatana\b/i, "katana"],
  [/\bmidas\b/i, "midas"],
  [/\btermmax\b/i, "termmax"],
  [/\blido\b/i, "lido"],
  [/\bsierra\b/i, "sierra"],
  [/\bacre\b/i, "acre"],
  [/\bfalcon\b/i, "falcon"],
  [/\btelosc\b/i, "telosc"],
  [/\bmfarm\b/i, "mfarm"],
  [/\btrevee\b/i, "trevee"],
  [/\b9summits\b/i, "9summits"],
  [/\bre7\b/i, "re7"],
  [/\bk3\b/i, "k3"],
];

export function extractProtocol(
  description: string,
  name?: string,
  apiProtocol?: string
): string {
  // Prefer the protocol field from the API if provided
  if (apiProtocol) {
    const normalized = apiProtocol.toLowerCase().trim();
    // Check if it matches a known protocol pattern
    for (const [pattern, protocol] of PROTOCOL_PATTERNS) {
      if (pattern.test(normalized)) {
        return protocol;
      }
    }
    // Use the API value as-is if non-empty
    if (normalized.length > 0) {
      return normalized;
    }
  }

  const text = `${description} ${name ?? ""}`;

  for (const [pattern, protocol] of PROTOCOL_PATTERNS) {
    if (pattern.test(text)) {
      return protocol;
    }
  }

  return "unknown";
}

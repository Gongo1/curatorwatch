/**
 * Email delivery via the Resend HTTP API (no SDK dependency — one endpoint).
 *
 * Degrades loudly-but-safely: with no RESEND_API_KEY every send() returns
 * { sent: false, reason: "not configured" } so subscribe flows and crons can
 * ship dark and light up when the key lands (same pattern as the deposit
 * feature flag). Every email carries the subscriber's unsubscribe link.
 *
 * Env: RESEND_API_KEY (required to send), ALERTS_FROM_EMAIL (optional,
 * defaults to alerts@curatorwatch.com — the domain must be verified in Resend).
 */

const RESEND_URL = "https://api.resend.com/emails";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://curatorwatch.com";

const FROM = process.env.ALERTS_FROM_EMAIL || "CuratorWatch <alerts@curatorwatch.com>";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "not configured (RESEND_API_KEY missing)" };

  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { sent: false, reason: `Resend ${response.status}: ${body.slice(0, 200)}` };
  }
  return { sent: true };
}

// ── Templates ────────────────────────────────────────────────────────────────
// Plain, single-column, inline-styled — email clients ignore stylesheets.

const wrap = (inner: string, unsubUrl?: string) => `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f2;">
<div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#1a1a19;">
  <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b6a66;margin-bottom:18px;">CuratorWatch</div>
  ${inner}
  <div style="margin-top:28px;padding-top:14px;border-top:1px solid #dedcd5;font-size:11px;color:#8a8880;line-height:1.6;">
    Data updates every 6 hours · <a href="${SITE_URL}" style="color:#8a8880;">curatorwatch.com</a>
    ${unsubUrl ? ` · <a href="${unsubUrl}" style="color:#8a8880;">unsubscribe</a>` : ""}
  </div>
</div>
</body></html>`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function confirmEmail(confirmUrl: string, curatorNames: string[], wantsDigest: boolean): { subject: string; html: string } {
  const what = [
    curatorNames.length > 0 ? `alerts for ${esc(curatorNames.join(", "))}` : null,
    wantsDigest ? "the daily digest" : null,
  ]
    .filter(Boolean)
    .join(" and ");
  return {
    subject: "Confirm your CuratorWatch alerts",
    html: wrap(`
      <p style="font-size:14px;line-height:1.6;">You (or someone using this address) asked for ${what || "alerts"} from CuratorWatch.</p>
      <p style="margin:22px 0;"><a href="${confirmUrl}" style="background:#1a1a19;color:#fcfcfb;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;display:inline-block;">Confirm subscription</a></p>
      <p style="font-size:12px;color:#6b6a66;line-height:1.6;">If this wasn't you, ignore this email — nothing is sent without confirmation.</p>`),
  };
}

export interface AlertEmailItem {
  severity: string;
  title: string;
  description: string;
  curatorName: string | null;
  detectedAt: Date;
}

const sevColor = (s: string) => (s === "critical" ? "#c03d3d" : s === "warning" ? "#b07d1a" : "#6b6a66");

export function alertsEmail(items: AlertEmailItem[], unsubUrl: string): { subject: string; html: string } {
  const critical = items.filter((i) => i.severity === "critical").length;
  const subject =
    critical > 0
      ? `${critical} critical alert${critical === 1 ? "" : "s"} on your curators`
      : `${items.length} alert${items.length === 1 ? "" : "s"} on your curators`;
  const rows = items
    .map(
      (i) => `
    <div style="padding:12px 0;border-bottom:1px solid #eceae4;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:${sevColor(i.severity)};">
        ${esc(i.severity)}${i.curatorName ? ` · ${esc(i.curatorName)}` : ""} · ${i.detectedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
      </div>
      <div style="font-size:14px;font-weight:600;margin-top:3px;">${esc(i.title)}</div>
      <div style="font-size:13px;color:#454440;line-height:1.55;margin-top:3px;">${esc(i.description)}</div>
    </div>`
    )
    .join("");
  return {
    subject,
    html: wrap(
      `${rows}
      <p style="margin-top:18px;"><a href="${SITE_URL}/alerts" style="color:#2456c6;font-size:13px;">All alerts →</a></p>`,
      unsubUrl
    ),
  };
}

export function digestEmail(d: { slug: string; title: string; summary: string | null; bodyMarkdown: string }, unsubUrl: string): { subject: string; html: string } {
  // Minimal markdown → email HTML: headings, paragraphs, and fenced code blocks
  // (the wire-format edition's fixed-width tables — must render monospace with
  // whitespace preserved or the columns collapse).
  const PRE_STYLE =
    "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;line-height:1.45;color:#33322f;background:#f4f3ef;border:1px solid #e4e2db;border-radius:6px;padding:10px 12px;margin:10px 0;overflow-x:auto;white-space:pre;";
  const renderText = (segment: string): string =>
    segment
      .split(/\n{2,}/)
      .map((block) => {
        const b = block.trim();
        if (!b) return "";
        if (/^#{1,3}\s/.test(b)) {
          return `<div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-top:18px;">${b.replace(/^#{1,3}\s+/, "")}</div>`;
        }
        return `<p style="font-size:13px;line-height:1.6;color:#33322f;margin:8px 0;">${b
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          // [text](url) → anchor (NEWSWIRE + spotlight links). esc() has run,
          // so hrefs keep &amp;-escaped query strings — valid HTML.
          .replace(
            /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
            '<a href="$2" style="color:#2456c6;">$1</a>'
          )
          .replace(/\n/g, "<br/>")}</p>`;
      })
      .join("");
  // Split on ``` fences (escaping first — esc() leaves backticks intact);
  // odd-indexed segments are code.
  const body = esc(d.bodyMarkdown)
    .split(/^```[a-z]*\n?|^```\s*$/m)
    .map((segment, i) =>
      i % 2 === 1 ? `<pre style="${PRE_STYLE}">${segment.replace(/\n+$/, "")}</pre>` : renderText(segment)
    )
    .join("");
  return {
    subject: d.title,
    html: wrap(
      `<div style="font-size:17px;font-weight:700;margin-bottom:6px;">${esc(d.title)}</div>
      ${d.summary ? `<div style="font-size:13px;color:#6b6a66;margin-bottom:14px;">${esc(d.summary)}</div>` : ""}
      ${body}
      <p style="margin-top:18px;"><a href="${SITE_URL}/digest" style="color:#2456c6;font-size:13px;">Read the full edition →</a></p>`,
      unsubUrl
    ),
  };
}

/**
 * Telegram channel push via the Bot API (no dependency — one endpoint).
 *
 * Broadcast model: alerts post to a public CuratorWatch channel; users join
 * the channel, no per-user bot state. Degrades safely: with no
 * TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID every send returns
 * { sent: false, reason: "not configured" }.
 *
 * Env: TELEGRAM_BOT_TOKEN (from @BotFather), TELEGRAM_CHANNEL_ID
 * (@channelname or the -100… numeric id; the bot must be a channel admin).
 */

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID);
}

/** Escape for Telegram HTML parse mode. */
export function tgEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendTelegram(html: string): Promise<{ sent: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) return { sent: false, reason: "not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID missing)" };

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { sent: false, reason: `Telegram ${response.status}: ${body.slice(0, 200)}` };
  }
  return { sent: true };
}

const SEV_ICON: Record<string, string> = { critical: "🔴", warning: "🟡", info: "⚪️" };

export function formatAlertTg(a: {
  severity: string;
  title: string;
  description: string;
  curatorName: string | null;
}, siteUrl: string): string {
  const icon = SEV_ICON[a.severity] ?? "⚪️";
  const head = a.curatorName ? `${tgEscape(a.curatorName)} — ` : "";
  return (
    `${icon} <b>${head}${tgEscape(a.title)}</b>\n` +
    `${tgEscape(a.description)}\n` +
    `<a href="${siteUrl}/alerts">curatorwatch.com/alerts</a>`
  );
}

export function formatDigestTg(d: { title: string; summary: string | null }, siteUrl: string): string {
  return (
    `📰 <b>${tgEscape(d.title)}</b>\n` +
    (d.summary ? `${tgEscape(d.summary)}\n` : "") +
    `<a href="${siteUrl}/digest">Read the full edition</a>`
  );
}

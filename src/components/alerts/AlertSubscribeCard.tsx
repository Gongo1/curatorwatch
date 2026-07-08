"use client";

/* Hallmark · component: subscribe-form · genre: editorial · theme: Slate Terminal
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46-50)
 */
import { useEffect, useMemo, useState } from "react";

interface CuratorOption {
  id: string;
  name: string;
}

/**
 * Email alert subscription: pick counterparties (curators) and/or the daily
 * digest, double-opt-in by email. Also links the Telegram channel when the
 * public env var for it is set.
 */
export function AlertSubscribeCard() {
  const [curators, setCurators] = useState<CuratorOption[]>([]);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [wantsDigest, setWantsDigest] = useState(true);
  const [state, setState] = useState<"idle" | "submitting" | "sent" | "updated" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const tgChannel = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL;
  const [banner, setBanner] = useState<string | null>(null);

  // Feedback after the confirm/unsubscribe redirects (?subscribe=…)
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("subscribe");
    if (status === "confirmed") setBanner("Subscription confirmed — you're on the wire.");
    else if (status === "unsubscribed") setBanner("Unsubscribed. No more emails from us.");
    else if (status === "invalid") setBanner("That link is invalid or expired.");
  }, []);

  useEffect(() => {
    if (!open || curators.length > 0) return;
    fetch("/api/curators")
      .then((r) => r.json())
      .then((d) => {
        const items = (d?.data?.curators ?? []) as { curatorId: string; name: string | null }[];
        setCurators(
          items
            .filter((c) => c.curatorId && c.name)
            .map((c) => ({ id: c.curatorId, name: c.name! }))
        );
      })
      .catch(() => setCurators([]));
  }, [open, curators.length]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? curators.filter((c) => c.name.toLowerCase().includes(q)) : curators;
    return pool.slice(0, 8);
  }, [curators, query]);

  async function submit() {
    setState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, curatorIds: [...selected.keys()], wantsDigest }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || "Subscription failed");
      setState(body.status === "updated" ? "updated" : "sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Subscription failed");
      setState("error");
    }
  }

  if (banner) {
    return (
      <div className="border border-border rounded-2xl bg-background-subtle px-5 py-4 mb-6 font-mono text-sm text-text-secondary">
        {banner}
      </div>
    );
  }

  if (state === "sent" || state === "updated") {
    return (
      <div className="border border-border rounded-2xl bg-background-subtle px-5 py-4 mb-6 font-mono text-sm">
        <span className="text-accent-green">✓</span>{" "}
        {state === "sent"
          ? `Check ${email} — click the confirmation link and you're on the wire.`
          : "Preferences updated."}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="border border-border rounded-2xl bg-background-subtle px-5 py-3.5 mb-6 flex items-center gap-3 flex-wrap">
        <span className="font-mono text-sm text-text-secondary">
          Get alerts on the counterparties you care about — by email
          {tgChannel ? " or Telegram" : ""}.
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          {tgChannel && (
            <a
              href={tgChannel}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:border-accent-blue hover:text-accent-blue transition-colors"
            >
              Telegram channel →
            </a>
          )}
          <button
            onClick={() => setOpen(true)}
            className="font-mono text-xs px-3 py-1.5 rounded-lg bg-accent-blue text-white hover:opacity-90 active:translate-y-px transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-blue focus-visible:outline-offset-2"
          >
            Email alerts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl bg-background-subtle p-5 mb-6">
      <div className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary mb-3">
        Email alerts — pick your counterparties
      </div>

      {/* Selected chips */}
      {selected.size > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {[...selected.entries()].map(([id, name]) => (
            <button
              key={id}
              onClick={() => {
                const next = new Map(selected);
                next.delete(id);
                setSelected(next);
              }}
              className="font-mono text-xs px-2 py-1 rounded-md bg-background-elevated border border-border text-text-primary hover:border-accent-red transition-colors"
              title="Remove"
            >
              {name} ×
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={curators.length ? "Search curators…" : "Loading curators…"}
        className="w-full font-mono text-sm bg-background-elevated border border-border rounded-lg px-3 py-2 mb-1.5 focus:outline-none focus:border-accent-blue placeholder:text-text-muted"
      />
      {query.trim() && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {matches.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                const next = new Map(selected);
                next.set(c.id, c.name);
                setSelected(next);
                setQuery("");
              }}
              disabled={selected.has(c.id)}
              className="font-mono text-xs px-2 py-1 rounded-md border border-border-subtle text-text-secondary hover:border-accent-blue hover:text-accent-blue disabled:opacity-40 transition-colors"
            >
              + {c.name}
            </button>
          ))}
          {matches.length === 0 && (
            <span className="font-mono text-xs text-text-muted py-1">No curator matches</span>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 font-mono text-sm text-text-secondary mb-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={wantsDigest}
          onChange={(e) => setWantsDigest(e.target.checked)}
          className="accent-[var(--accent-blue,#3b82f6)]"
        />
        Also send me the daily digest
      </label>

      <div className="flex gap-2 flex-wrap">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@fund.xyz"
          className="flex-1 min-w-[220px] font-mono text-sm bg-background-elevated border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent-blue placeholder:text-text-muted"
        />
        <button
          onClick={submit}
          disabled={state === "submitting" || !email || (selected.size === 0 && !wantsDigest)}
          className="font-mono text-sm px-4 py-2 rounded-lg bg-accent-blue text-white hover:opacity-90 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-blue focus-visible:outline-offset-2"
        >
          {state === "submitting" ? "Sending…" : "Subscribe"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="font-mono text-sm px-3 py-2 rounded-lg border border-border text-text-tertiary hover:text-text-secondary transition-colors"
        >
          Cancel
        </button>
      </div>

      {error && <div className="font-mono text-xs text-accent-red mt-2.5">{error}</div>}
      <div className="font-mono text-[11px] text-text-muted mt-3 leading-relaxed">
        Warning + critical alerts on your curators, batched with the 6h data refresh. Double
        opt-in; unsubscribe link in every email.
        {tgChannel && (
          <>
            {" "}Prefer Telegram? <a href={tgChannel} target="_blank" rel="noopener noreferrer" className="text-accent-blue">Join the channel</a> — all warning/critical alerts + the daily digest.
          </>
        )}
      </div>
    </div>
  );
}

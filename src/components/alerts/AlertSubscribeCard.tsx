"use client";

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
    if (status === "confirmed") setBanner("Subscription confirmed. You will get the alerts by email.");
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
      <div className="panel px-3 py-2.5 text-sm text-text-secondary">
        {banner}
      </div>
    );
  }

  if (state === "sent" || state === "updated") {
    return (
      <div className="panel px-3 py-2.5 text-sm text-text-secondary">
        <span className="up" aria-hidden="true">✓</span>{" "}
        {state === "sent"
          ? <>Check <span className="num text-text-primary">{email}</span> and select the confirmation link to start the alerts.</>
          : "Preferences updated."}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="panel px-3 py-2 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-text-secondary">
          Get alerts on the counterparties you care about, by email
          {tgChannel ? " or Telegram" : ""}.
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {tgChannel && (
            <a
              href={tgChannel}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              Telegram channel →
            </a>
          )}
          <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
            Email alerts
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Email alerts</h2>
        <span className="panel-meta">pick your counterparties</span>
      </div>
      <div className="p-3">
        {/* Selected chips */}
        {selected.size > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {[...selected.entries()].map(([id, name]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const next = new Map(selected);
                  next.delete(id);
                  setSelected(next);
                }}
                className="text-xs h-6 px-2 bg-background-elevated border border-border-strong text-text-primary hover:border-accent-red hover:text-accent-red transition-colors"
                title="Remove"
                aria-label={`Remove ${name}`}
              >
                {name} ×
              </button>
            ))}
          </div>
        )}

        <label htmlFor="alert-sub-curator" className="label block mb-1.5">Curators</label>
        <input
          id="alert-sub-curator"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={curators.length ? "Search curators…" : "Loading curators…"}
          className="field text-sm mb-1.5"
        />
        {query.trim() && (
          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {matches.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  const next = new Map(selected);
                  next.set(c.id, c.name);
                  setSelected(next);
                  setQuery("");
                }}
                disabled={selected.has(c.id)}
                className="text-xs h-6 px-2 border border-border text-text-secondary hover:border-accent-blue hover:text-accent-blue disabled:opacity-40 transition-colors"
              >
                + {c.name}
              </button>
            ))}
            {matches.length === 0 && (
              <span className="text-xs text-text-muted py-1">No curator matches. Check the spelling.</span>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-text-secondary my-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={wantsDigest}
            onChange={(e) => setWantsDigest(e.target.checked)}
            className="accent-[var(--accent-blue)]"
          />
          Also send me the daily digest
        </label>

        <label htmlFor="alert-sub-email" className="label block mb-1.5">Email</label>
        <div className="flex gap-1.5 flex-wrap">
          <input
            id="alert-sub-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@fund.xyz"
            className="field text-sm flex-1 min-w-[200px] w-auto"
          />
          <button
            type="button"
            onClick={submit}
            disabled={state === "submitting" || !email || (selected.size === 0 && !wantsDigest)}
            className="btn btn-primary"
          >
            {state === "submitting" ? "Sending…" : "Subscribe"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
            Cancel
          </button>
        </div>

        {error && <div className="text-xs text-accent-red mt-2">{error}</div>}
        <p className="text-xs text-text-tertiary mt-2.5 pt-2.5 border-t border-border-subtle leading-relaxed">
          Warning and critical alerts on your curators, batched with the 6h data refresh. Double
          opt-in; every email has an unsubscribe link.
          {tgChannel && (
            <>
              {" "}Prefer Telegram?{" "}
              <a href={tgChannel} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:underline">
                Join the channel
              </a>{" "}
              for all warning and critical alerts and the daily digest.
            </>
          )}
        </p>
      </div>
    </section>
  );
}

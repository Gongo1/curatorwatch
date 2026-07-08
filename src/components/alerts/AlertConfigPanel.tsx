"use client";

/* Hallmark · component: subscribe-config · genre: editorial · theme: Slate Terminal
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46-50)
 */
import { useEffect, useMemo, useState } from "react";

interface CuratorOption {
  id: string;
  name: string;
  tvlUsd: number;
}

function compactUsd(n: number): string {
  if (!n) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

/**
 * Alert Configuration panel (lives in its own /alerts tab). Pick any
 * counterparties from the full list, opt into the daily digest, drop your
 * email. Double opt-in; the email is captured even before delivery is live.
 */
export function AlertConfigPanel() {
  const [curators, setCurators] = useState<CuratorOption[]>([]);
  const [loadingCurators, setLoadingCurators] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [wantsDigest, setWantsDigest] = useState(true);
  const [state, setState] = useState<"idle" | "submitting" | "sent" | "pending" | "updated" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const tgChannel = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL;

  // Feedback after the confirm/unsubscribe redirects (?subscribe=…)
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("subscribe");
    if (status === "confirmed") setBanner("Subscription confirmed — you're on the wire.");
    else if (status === "unsubscribed") setBanner("Unsubscribed. No more emails from us.");
    else if (status === "invalid") setBanner("That link is invalid or expired.");
  }, []);

  useEffect(() => {
    // The API caps pageSize at 100; page through to get every counterparty.
    (async () => {
      type Item = { curatorId: string; name: string | null; totalAUM?: number };
      const all: Item[] = [];
      try {
        for (let page = 1; page <= 20; page++) {
          const res = await fetch(`/api/curators?pageSize=100&page=${page}&sortBy=aum&sortOrder=desc`);
          const d = await res.json();
          const items = (d?.data?.curators ?? []) as Item[];
          all.push(...items);
          const total = d?.data?.pagination?.total ?? all.length;
          if (all.length >= total || items.length === 0) break;
        }
        setCurators(
          all
            .filter((c) => c.curatorId && c.name)
            .map((c) => ({ id: c.curatorId, name: c.name!, tvlUsd: c.totalAUM ?? 0 }))
            .sort((a, b) => b.tvlUsd - a.tvlUsd)
        );
      } catch {
        setCurators([]);
      } finally {
        setLoadingCurators(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? curators.filter((c) => c.name.toLowerCase().includes(q)) : curators;
  }, [curators, query]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function submit() {
    setState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, curatorIds: [...selected], wantsDigest }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || "Subscription failed");
      setState(body.status === "updated" ? "updated" : body.status === "saved_pending" ? "pending" : "sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Subscription failed");
      setState("error");
    }
  }

  if (banner) {
    return (
      <div className="border border-border rounded-2xl bg-background-subtle px-5 py-4 font-mono text-sm text-text-secondary">
        {banner}
      </div>
    );
  }

  if (state === "sent" || state === "updated" || state === "pending") {
    return (
      <div className="border border-border rounded-2xl bg-background-subtle px-5 py-5 font-mono text-sm leading-relaxed">
        <span className="text-accent-green">✓</span>{" "}
        {state === "sent" && `Check ${email} — click the confirmation link and you're on the wire.`}
        {state === "updated" && "Preferences updated."}
        {state === "pending" && (
          <>
            You&rsquo;re on the list ({email}). Email delivery is being switched on — we&rsquo;ll send your
            confirmation link the moment it&rsquo;s live.
          </>
        )}
        <button
          onClick={() => setState("idle")}
          className="ml-3 text-accent-blue hover:underline"
        >
          edit
        </button>
      </div>
    );
  }

  const total = curators.length;

  return (
    <div className="border border-border rounded-2xl bg-background-subtle overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle">
        <div className="font-mono text-xs uppercase tracking-[0.1em] text-text-tertiary">
          Email alerts — pick your counterparties
        </div>
        <p className="font-mono text-[13px] text-text-secondary mt-1.5 leading-relaxed">
          Select any curators below and we&rsquo;ll email you their warning + critical alerts, batched with the
          6-hour data refresh. Double opt-in; unsubscribe link in every email.
        </p>
      </div>

      {/* Counterparty picker */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-3 mb-2.5 flex-wrap">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={loadingCurators ? "Loading counterparties…" : `Search ${total} counterparties…`}
            className="flex-1 min-w-[200px] font-mono text-sm bg-background-elevated border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-accent-blue placeholder:text-text-muted"
          />
          <span className="font-mono text-xs text-text-tertiary tabular-nums">{selected.size} selected</span>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              className="font-mono text-xs text-text-tertiary hover:text-accent-red transition-colors"
            >
              clear
            </button>
          )}
          {query.trim() && filtered.length > 0 && (
            <button
              onClick={() => setSelected(new Set([...selected, ...filtered.map((c) => c.id)]))}
              className="font-mono text-xs text-accent-blue hover:underline"
            >
              select {filtered.length} shown
            </button>
          )}
        </div>

        <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border-subtle divide-y divide-border-subtle">
          {loadingCurators ? (
            <div className="px-3 py-8 text-center font-mono text-xs text-text-muted">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-8 text-center font-mono text-xs text-text-muted">No counterparty matches</div>
          ) : (
            filtered.map((c) => {
              const on = selected.has(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    on ? "bg-accent-blue/5" : "hover:bg-background-elevated/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(c.id)}
                    className="accent-[var(--accent-blue,#3b82f6)] flex-none"
                  />
                  <span className="font-mono text-sm text-text-primary truncate flex-1">{c.name}</span>
                  <span className="font-mono text-[11px] text-text-tertiary tabular-nums flex-none">
                    {compactUsd(c.tvlUsd)}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Digest + email + submit */}
      <div className="px-5 py-4">
        <label className="flex items-center gap-2 font-mono text-sm text-text-secondary mb-3.5 cursor-pointer select-none">
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
            className="font-mono text-sm px-5 py-2 rounded-lg bg-accent-blue text-white hover:opacity-90 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-blue focus-visible:outline-offset-2"
          >
            {state === "submitting" ? "Saving…" : "Subscribe"}
          </button>
        </div>

        {error && <div className="font-mono text-xs text-accent-red mt-2.5">{error}</div>}

        {tgChannel && (
          <div className="font-mono text-[11px] text-text-muted mt-3.5 pt-3.5 border-t border-border-subtle leading-relaxed">
            Prefer Telegram?{" "}
            <a href={tgChannel} target="_blank" rel="noopener noreferrer" className="text-accent-blue">
              Join the channel →
            </a>{" "}
            for all warning/critical alerts + the daily digest (no email needed).
          </div>
        )}
      </div>
    </div>
  );
}

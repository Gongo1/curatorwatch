"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Bell, Check } from "lucide-react";
import { useGate } from "@/lib/gate/GateProvider";
import { trackGate } from "@/lib/gate/track";

// Home-page email delivery band: one-click Curator Daily digest opt-in (uses
// the account's Clerk-verified email — no confirmation round-trip) and a
// pointer to the /alerts page for per-curator alert configuration. Anonymous
// visitors get the account modal; /alerts is walled for them anyway.

export function EmailDeliveryCard() {
  const { enabled, ready, isSignedIn, openGate } = useGate();
  const [wantsDigest, setWantsDigest] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled || !ready || !isSignedIn) return;
    let active = true;
    fetch("/api/account/digest")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => active && j && setWantsDigest(!!j.wantsDigest))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [enabled, ready, isSignedIn]);

  if (!enabled) return null;

  const toggleDigest = async () => {
    if (!isSignedIn) {
      openGate("digest");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const next = !wantsDigest;
      const res = await fetch("/api/account/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wantsDigest: next }),
      });
      if (res.ok) {
        setWantsDigest(next);
        if (next) trackGate("alert_optin_post_signup", { surface: "home_digest" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 grid sm:grid-cols-2 gap-4">
      <div className="flex items-center justify-between gap-4 border border-border rounded-xl bg-background-subtle px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <Mail className="w-4 h-4 text-accent-blue flex-none" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary">Curator Daily digest</div>
            <div className="font-mono text-xs text-text-tertiary truncate">
              The day&rsquo;s curator moves, in your inbox every morning
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleDigest}
          disabled={busy}
          className={`flex-none inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold font-mono transition-colors active:translate-y-px disabled:opacity-60 ${
            wantsDigest
              ? "border border-accent-green/40 bg-accent-green/10 text-accent-green"
              : "bg-accent-blue text-background hover:opacity-90"
          }`}
        >
          {wantsDigest ? (
            <>
              <Check className="w-3.5 h-3.5" /> On
            </>
          ) : busy ? (
            "Saving…"
          ) : (
            "Yes, send it"
          )}
        </button>
      </div>

      <Link
        href="/alerts"
        className="flex items-center justify-between gap-4 border border-border rounded-xl bg-background-subtle px-5 py-4 hover:border-accent-blue transition-colors group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Bell className="w-4 h-4 text-accent-blue flex-none" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
              Curator alerts by email
            </div>
            <div className="font-mono text-xs text-text-tertiary truncate">
              Pick which curators ping you — configure on the Alerts page
            </div>
          </div>
        </div>
        <span className="flex-none font-mono text-xs text-accent-blue">Configure →</span>
      </Link>
    </div>
  );
}

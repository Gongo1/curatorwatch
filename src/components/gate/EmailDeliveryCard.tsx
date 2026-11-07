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
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Delivery</h2>
        <span className="panel-meta">email</span>
      </div>
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-border-subtle">
        <div className="flex items-start gap-2.5 min-w-0">
          <Mail className="w-4 h-4 mt-0.5 text-accent-blue flex-none" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary">Curator Daily</div>
            <div className="text-xs text-text-tertiary">The day&rsquo;s curator moves, 05:30 UTC</div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleDigest}
          disabled={busy}
          aria-pressed={!!wantsDigest}
          className={`btn h-7 px-2.5 flex-none ${
            wantsDigest ? "border-accent-green/50 text-accent-green" : "btn-primary"
          }`}
        >
          {wantsDigest ? (
            <>
              <Check className="w-3.5 h-3.5" aria-hidden="true" /> On
            </>
          ) : busy ? (
            "Saving"
          ) : (
            "Send it"
          )}
        </button>
      </div>

      <Link
        href="/alerts"
        className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-background-hover transition-colors group"
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <Bell className="w-4 h-4 mt-0.5 text-accent-blue flex-none" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors">
              Curator alerts
            </div>
            <div className="text-xs text-text-tertiary">Choose which curators email you</div>
          </div>
        </div>
        <span className="label text-accent-blue flex-none">Set up</span>
      </Link>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { GATE_ENABLED } from "@/lib/gate/config";
import { useGate } from "@/lib/gate/GateProvider";

// The ambient signup path: a quiet ghost button for anonymous users who never
// hit a hard trigger. Signed-in users see their handle (click = sign out).
// Renders nothing while auth state resolves — no locked-flash, no layout jank
// beyond its own row appearing.

function AccountCTALive() {
  const { ready, isSignedIn, openGate } = useGate();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setHandle(null);
      return;
    }
    let active = true;
    fetch("/api/account/handle")
      .then((r) => r.json())
      .then((j) => active && setHandle(j?.handle ?? null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  if (!ready) return null;

  if (isSignedIn) {
    const label = handle ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "account";
    return (
      <button
        type="button"
        onClick={() => signOut()}
        title="Sign out"
        className="w-full flex items-center gap-2 rounded-lg border border-border bg-background-subtle px-3 py-2 font-mono text-xs text-text-secondary hover:text-text-primary hover:border-accent-blue/50 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-accent-blue flex-none" />
        <span className="truncate">@{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openGate("header")}
      className="w-full rounded-lg border border-border px-3 py-2 font-mono text-xs font-semibold text-text-primary hover:border-accent-blue hover:text-accent-blue transition-colors"
    >
      Create free account
    </button>
  );
}

export function AccountCTA() {
  if (!GATE_ENABLED) return null;
  return <AccountCTALive />;
}

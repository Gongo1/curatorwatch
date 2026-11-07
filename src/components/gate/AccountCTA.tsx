"use client";

import { useEffect, useRef, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { GATE_ENABLED } from "@/lib/gate/config";
import { useGate } from "@/lib/gate/GateProvider";

// Top-bar account control. Anonymous: "Sign in" + the amber "Create account".
// Signed in: the handle, which opens a one-item menu to sign out. Renders
// nothing while auth resolves, so returning users never see a locked flash.

function AccountCTALive() {
  const { ready, isSignedIn, openGate } = useGate();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [handle, setHandle] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) {
        setMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  if (!ready) return <div className="w-[9.5rem]" aria-hidden="true" />;

  if (isSignedIn) {
    const label = handle ?? user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "account";
    return (
      <div ref={wrap} className="relative">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-haspopup="menu"
          aria-expanded={menu}
          className="flex items-center gap-2 h-8 px-2.5 border border-border-strong font-mono text-xs text-text-primary hover:border-accent-blue transition-colors max-w-[11rem]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green flex-none" aria-hidden="true" />
          <span className="truncate">@{label}</span>
        </button>
        {menu && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-px z-50 min-w-[11rem] bg-background-subtle border border-border-strong shadow-[0_12px_32px_-8px_oklch(0%_0_0/0.7)]"
          >
            <div className="px-3 py-2 border-b border-border">
              <div className="label">Signed in</div>
              <div className="text-xs text-text-secondary truncate mt-0.5">
                {user?.primaryEmailAddress?.emailAddress}
              </div>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut()}
              className="w-full text-left px-3 h-8 text-sm text-text-primary hover:bg-background-hover"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => openGate("signin")}
        className="btn h-8 px-2.5 text-text-secondary hover:text-text-primary"
      >
        Sign in
      </button>
      <button type="button" onClick={() => openGate("header")} className="btn btn-primary h-8">
        <span className="hidden sm:inline">Create account</span>
        <span className="sm:hidden">Join</span>
      </button>
    </div>
  );
}

export function AccountCTA() {
  if (!GATE_ENABLED) return null;
  return <AccountCTALive />;
}

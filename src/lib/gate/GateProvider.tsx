"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";
import { GATE_ENABLED, safeNextPath } from "./config";
import { trackGate } from "./track";
import { CreateAccountModal } from "@/components/gate/CreateAccountModal";

export interface GateApi {
  /** Build-time flag — false means the whole gate feature is dark. */
  enabled: boolean;
  /** True once the auth state is known (prevents locked-flash for returning users). */
  ready: boolean;
  isSignedIn: boolean;
  /** Open the Create Account modal for a trigger (e.g. "table", "compare"). */
  openGate: (trigger: string) => void;
}

const noopApi: GateApi = {
  enabled: false,
  ready: true,
  isSignedIn: false,
  openGate: () => {},
};

const GateContext = createContext<GateApi>(noopApi);

export function useGate(): GateApi {
  return useContext(GateContext);
}

function GateProviderLive({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const [trigger, setTrigger] = useState<string | null>(null);
  const [dest, setDest] = useState<string | null>(null);
  const triggerRef = useRef<string | null>(null);
  triggerRef.current = trigger;

  // Wall redirects land on /?join=1&next=<original page> — auto-open the modal
  // once auth resolves (and strip the params so refreshes/shares don't
  // re-trigger it). `next` is where the flow returns the user on completion.
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("join") === "1") {
        const next = safeNextPath(params.get("next"));
        params.delete("join");
        params.delete("next");
        const qs = params.toString();
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (qs ? `?${qs}` : "")
        );
        if (!isSignedIn) {
          setDest(next);
          setTrigger("wall");
          trackGate("modal_open", { trigger: "wall" });
        }
      }
    } catch {
      // URL APIs unavailable — never break the page for the modal's sake.
    }
  }, [isLoaded, isSignedIn]);

  // OAuth signups never pass the modal's handle step — when a signed-in user
  // has no handle yet, reopen the modal directly on the claim step (also
  // catches returning users who dismissed it before claiming).
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let active = true;
    fetch("/api/account/handle")
      .then((r) => r.json())
      .then((j) => {
        if (!active || j?.handle || triggerRef.current !== null) return;
        setTrigger("handle");
        trackGate("modal_open", { trigger: "handle" });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn]);

  const openGate = useCallback(
    (t: string) => {
      trackGate("gate_click", { trigger: t });
      if (isSignedIn) return; // gated UI shouldn't render signed-in; belt & braces
      setTrigger(t);
      trackGate("modal_open", { trigger: t });
    },
    [isSignedIn]
  );

  return (
    <GateContext.Provider
      value={{ enabled: true, ready: isLoaded, isSignedIn: !!isSignedIn, openGate }}
    >
      {children}
      {trigger !== null && (
        <CreateAccountModal
          trigger={trigger}
          dest={dest}
          initialStep={trigger === "handle" ? "handle" : "email"}
          onClose={() => setTrigger(null)}
        />
      )}
    </GateContext.Provider>
  );
}

function GateProviderOff({ children }: { children: ReactNode }) {
  return <GateContext.Provider value={noopApi}>{children}</GateContext.Provider>;
}

// Build-time constant switch (NEXT_PUBLIC_ inlining) — hook order is stable.
export const GateProvider = GATE_ENABLED ? GateProviderLive : GateProviderOff;

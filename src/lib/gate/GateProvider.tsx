"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";
import { GATE_ENABLED } from "./config";
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

  // Wall redirects land on /?join=1 — auto-open the modal once auth resolves
  // (and strip the param so refreshes/shares don't re-trigger it).
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("join") === "1") {
        params.delete("join");
        const qs = params.toString();
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (qs ? `?${qs}` : "")
        );
        if (!isSignedIn) {
          setTrigger("wall");
          trackGate("modal_open", { trigger: "wall" });
        }
      }
    } catch {
      // URL APIs unavailable — never break the page for the modal's sake.
    }
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
        <CreateAccountModal trigger={trigger} onClose={() => setTrigger(null)} />
      )}
    </GateContext.Provider>
  );
}

function GateProviderOff({ children }: { children: ReactNode }) {
  return <GateContext.Provider value={noopApi}>{children}</GateContext.Provider>;
}

// Build-time constant switch (NEXT_PUBLIC_ inlining) — hook order is stable.
export const GateProvider = GATE_ENABLED ? GateProviderLive : GateProviderOff;

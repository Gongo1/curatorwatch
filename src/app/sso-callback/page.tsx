"use client";

import { useEffect, useRef } from "react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { GATE_ENABLED, safeNextPath } from "@/lib/gate/config";
import { trackGate } from "@/lib/gate/track";

// Clerk OAuth landing: FAPI redirects here when the SSO round-trip needs
// client-side completion — chiefly a first-time Google user whose sign-in
// must transfer to a sign-up. Follows the documented custom-flow callback
// for the v7 future API. Every success path exits via a hard navigation so
// middleware, server renders, and client fetches all see the new session.

function SsoCallbackLive() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const ran = useRef(false);

  useEffect(() => {
    if (!clerk.loaded || !signIn || !signUp || ran.current) return;
    ran.current = true;

    const dest =
      safeNextPath(new URLSearchParams(window.location.search).get("next")) ?? "/";
    const land = () => window.location.assign(dest);
    const fail = () =>
      window.location.assign(`/?join=1&next=${encodeURIComponent(dest)}`);

    (async () => {
      // Straight sign-in (existing OAuth user).
      if (signIn.status === "complete") {
        const fin = await signIn.finalize();
        return fin.error ? fail() : land();
      }

      // The OAuth account already belongs to a user — transfer to a sign-in.
      if (signUp.isTransferable) {
        await signIn.create({ transfer: true });
        if ((signIn.status as string) === "complete") {
          const fin = await signIn.finalize();
          return fin.error ? fail() : land();
        }
        return fail();
      }

      // First-time OAuth user — transfer the sign-in to a sign-up.
      if (signIn.isTransferable) {
        const created = await signUp.create({ transfer: true });
        if (!created.error && signUp.status === "complete") {
          trackGate("signup_complete", { trigger: "sso", step: "google" });
          const fin = await signUp.finalize();
          return fin.error ? fail() : land();
        }
        return fail();
      }

      // Sign-up finished server-side.
      if (signUp.status === "complete") {
        const fin = await signUp.finalize();
        return fin.error ? fail() : land();
      }

      // The account already has an active session on this client.
      const sessionId =
        signIn.existingSession?.sessionId ?? signUp.existingSession?.sessionId;
      if (sessionId) {
        await clerk.setActive({ session: sessionId });
        return land();
      }

      fail();
    })();
  }, [clerk, signIn, signUp]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <p className="font-mono text-sm text-text-tertiary">Signing you in…</p>
      {/* A transferred sign-up may require captcha — Clerk mounts it here. */}
      <div id="clerk-captcha" />
    </div>
  );
}

// Outside the gate flag there's no ClerkProvider, so the live component
// (whose hooks require it) must not mount. Build-time constant — stable.
export default function SsoCallbackPage() {
  if (!GATE_ENABLED) return null;
  return <SsoCallbackLive />;
}

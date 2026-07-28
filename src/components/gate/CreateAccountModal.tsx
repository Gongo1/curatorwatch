"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { suggestHandle } from "@/lib/gate/config";
import { trackGate } from "@/lib/gate/track";

// Context-aware headlines — the modal mirrors the intent it interrupted.
const HEADLINES: Record<string, string> = {
  table: "See the full curator ranking",
  tools: "Unlock filters, search, and sorting",
  compare: "Compare curators side by side",
  calculator: "Show my projection",
  charts: "See the full TVL history",
  alerts: "Set your first alert",
  header: "Unlock all of CuratorWatch",
  soft: "Unlock all of CuratorWatch",
};

type Step = "email" | "code" | "handle";
type Mode = "signup" | "signin";

interface ClerkErrorLike {
  code?: string;
  longMessage?: string;
  message?: string;
}

function errMessage(e: ClerkErrorLike | null, fallback: string): string {
  return e?.longMessage ?? e?.message ?? fallback;
}

export function CreateAccountModal({
  trigger,
  onClose,
}: {
  trigger: string;
  onClose: () => void;
}) {
  // Clerk v7 "future" API: methods return { error } instead of throwing, and
  // finalize() converts a complete attempt into the active session.
  const { signUp } = useSignUp();
  const { signIn } = useSignIn();

  const [step, setStep] = useState<Step>("email");
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [handle, setHandle] = useState("");
  const [handleFree, setHandleFree] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completed = useRef(false);
  const stepRef = useRef<Step>("email");
  stepRef.current = step;

  // Abandon telemetry: fires on unmount unless the flow completed.
  useEffect(() => {
    return () => {
      if (!completed.current) {
        trackGate("modal_abandon", { trigger, step: stepRef.current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => onClose(), [onClose]);

  // ── Step 1: email → send code (sign-up, falling back to sign-in) ──
  const submitEmail = useCallback(async () => {
    if (!signUp || !signIn || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await signUp.create({ emailAddress: email.trim() });
      if (!created.error) {
        const sent = await signUp.verifications.sendEmailCode();
        if (sent.error) throw sent.error;
        setMode("signup");
      } else if (created.error.code === "form_identifier_exists") {
        // Existing account — same UX, sign-in code instead.
        const si = await signIn.create({ identifier: email.trim() });
        if (si.error) throw si.error;
        const sent = await signIn.emailCode.sendCode();
        if (sent.error) throw sent.error;
        setMode("signin");
      } else {
        throw created.error;
      }
      setHandle(suggestHandle(email.trim()));
      setStep("code");
    } catch (e) {
      setError(errMessage(e as ClerkErrorLike, "Couldn't send the code — try again."));
    } finally {
      setBusy(false);
    }
  }, [email, busy, signUp, signIn]);

  // ── Step 2: verify code, activate session ──
  const submitCode = useCallback(async () => {
    if (!signUp || !signIn || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const v = await signUp.verifications.verifyEmailCode({ code: code.trim() });
        if (v.error) throw v.error;
        const fin = await signUp.finalize();
        if (fin.error) throw fin.error;
        setStep("handle"); // new account always claims a handle
      } else {
        const v = await signIn.emailCode.verifyCode({ code: code.trim() });
        if (v.error) throw v.error;
        const fin = await signIn.finalize();
        if (fin.error) throw fin.error;
        // Returning user: only show the handle step if they never claimed one.
        const r = await fetch("/api/account/handle").then((x) => x.json());
        if (r?.handle) {
          completed.current = true;
          trackGate("signup_complete", { trigger, step: "signin" });
          close();
        } else {
          setStep("handle");
        }
      }
    } catch (e) {
      setError(errMessage(e as ClerkErrorLike, "That code didn't match — try again."));
    } finally {
      setBusy(false);
    }
  }, [busy, mode, code, signUp, signIn, trigger, close]);

  // ── Step 3: claim handle (pre-filled; one click for the median user) ──
  useEffect(() => {
    if (step !== "handle" || !handle) return;
    let active = true;
    setHandleFree(null);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/account/handle?check=${encodeURIComponent(handle)}`
        ).then((x) => x.json());
        if (active) setHandleFree(!!r.available);
      } catch {
        if (active) setHandleFree(null);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [step, handle]);

  const submitHandle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/handle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Couldn't save that handle");
      completed.current = true;
      trackGate("signup_complete", { trigger, step: mode });
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [busy, handle, trigger, mode, close]);

  const headline = HEADLINES[trigger] ?? HEADLINES.header;
  const onEnter =
    step === "email" ? submitEmail : step === "code" ? submitCode : submitHandle;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-background-elevated p-6 shadow-2xl">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="font-display font-bold text-xl tracking-tight pr-6">{headline}</h2>
        <p className="font-mono text-xs text-text-tertiary mt-1">
          Free · no card · takes ~10 seconds
        </p>

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onEnter();
          }}
        >
          {step === "email" && (
            <>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@fund.com"
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
              />
              {/* Clerk bot-protection mount: custom flows must provide this
                  element or Clerk falls back to its (unreliable) invisible
                  CAPTCHA. Renders empty unless a challenge is required. */}
              <div id="clerk-captcha" />
              <button
                type="submit"
                disabled={busy || !email.includes("@")}
                className="w-full rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send my code →"}
              </button>
            </>
          )}

          {step === "code" && (
            <>
              <p className="text-sm text-text-secondary">
                We sent a 6-digit code to{" "}
                <span className="text-text-primary font-medium">{email.trim()}</span>.
              </p>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
              />
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="w-full text-center font-mono text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                Wrong email? Go back
              </button>
            </>
          )}

          {step === "handle" && (
            <>
              <p className="text-sm text-text-secondary">
                Claim your handle — you can change it later.
              </p>
              <div className="relative">
                <input
                  required
                  autoFocus
                  value={handle}
                  onChange={(e) =>
                    setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  maxLength={20}
                  className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 font-mono text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                />
                {handleFree === false && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-accent-red">
                    taken
                  </span>
                )}
                {handleFree === true && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-accent-green">
                    available
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={busy || handle.length < 3 || handleFree === false}
                className="w-full rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy ? "Saving…" : "Continue →"}
              </button>
            </>
          )}

          {error && <p className="text-xs text-accent-red">{error}</p>}
        </form>

        <p className="mt-4 font-mono text-[10px] leading-relaxed text-text-muted">
          Join allocators tracking $24B in curated TVL. By continuing you agree to
          the Terms &amp; Privacy Policy.
        </p>
      </div>
    </div>
  );
}

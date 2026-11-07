"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ArrowLeft } from "lucide-react";
import { useSignIn, useSignUp, useUser } from "@clerk/nextjs";
import { GOOGLE_AUTH_ENABLED, HANDLE_RE, suggestHandle } from "@/lib/gate/config";
import { trackGate } from "@/lib/gate/track";

// Two-step sign-up / sign-in: email, then a 6-digit code that submits itself
// on the sixth digit. The handle is pre-filled from the email and claimed
// automatically on verification (editable inline on the code step), so the
// median user types an email and a code and is in. Existing emails fall
// through to sign-in with the same UI.

// Context-aware headlines — the panel mirrors the intent it interrupted.
const HEADLINES: Record<string, string> = {
  table: "See the full curator ranking",
  tools: "Search, sort, and filter every curator",
  compare: "Compare curators side by side",
  calculator: "Show my projection",
  charts: "See the full TVL history",
  alerts: "Set your first alert",
  header: "Open the full terminal",
  soft: "Open the full terminal",
  signin: "Sign in to CuratorWatch",
  wall: "This page needs a free account",
  digest: "Get the Curator Daily by email",
  explore: "See more of the data",
  handle: "Choose your handle",
};

type Step = "email" | "code" | "handle" | "done";
type Mode = "signup" | "signin";

const RESEND_SECONDS = 30;

interface ClerkErrorLike {
  code?: string;
  longMessage?: string;
  message?: string;
  /** ClerkAPIResponseError nests the per-field errors (with the real codes,
   *  e.g. form_identifier_exists) here — the top-level code is a wrapper. */
  errors?: Array<{ code?: string; longMessage?: string; message?: string }>;
}

function errMessage(e: ClerkErrorLike | null, fallback: string): string {
  const nested = e?.errors?.[0];
  return (
    nested?.longMessage ?? nested?.message ?? e?.longMessage ?? e?.message ?? fallback
  );
}

/** True when a sign-up error means "this email already has an account" — the
 *  cue to fall back to the sign-in flow. Checks the wrapper code, the nested
 *  API error codes, and (belt & braces) the message text. */
function isIdentifierExists(e: ClerkErrorLike | null): boolean {
  if (!e) return false;
  if (e.code === "form_identifier_exists") return true;
  if (e.errors?.some((x) => x?.code === "form_identifier_exists")) return true;
  const msg = `${e.longMessage ?? ""} ${e.message ?? ""} ${e.errors?.[0]?.longMessage ?? ""}`.toLowerCase();
  return msg.includes("taken") || msg.includes("already exists");
}

/** POST a handle; on a collision, retry with a short numeric suffix. Returns
 *  the claimed handle, or null when every attempt failed. */
async function claimHandle(preferred: string): Promise<string | null> {
  const base = preferred.slice(0, 16);
  const candidates = [
    preferred,
    `${base}-${Math.floor(100 + Math.random() * 900)}`,
    `${base}-${Math.floor(1000 + Math.random() * 9000)}`,
  ];
  for (const handle of candidates) {
    if (!HANDLE_RE.test(handle)) continue;
    const res = await fetch("/api/account/handle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    }).catch(() => null);
    if (res?.ok) return handle;
    if (res && res.status !== 409) return null;
  }
  return null;
}

export function CreateAccountModal({
  trigger,
  onClose,
  dest = null,
  initialStep = "email",
}: {
  trigger: string;
  onClose: () => void;
  /** Same-origin path to land on after auth completes (else reload in place). */
  dest?: string | null;
  /** "handle" opens straight on the claim step (OAuth signups arrive signed-in). */
  initialStep?: Step;
}) {
  // Clerk v7 "future" API: methods return { error } instead of throwing, and
  // finalize() converts a complete attempt into the active session.
  const { signUp } = useSignUp();
  const { signIn } = useSignIn();
  const { user } = useUser();

  const [step, setStep] = useState<Step>(initialStep);
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const [handle, setHandle] = useState(() =>
    initialStep === "handle"
      ? suggestHandle(user?.primaryEmailAddress?.emailAddress ?? "")
      : ""
  );
  const [editingHandle, setEditingHandle] = useState(false);
  const [handleFree, setHandleFree] = useState<boolean | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completed = useRef(false);
  const stepRef = useRef<Step>("email");
  stepRef.current = step;
  const triedCode = useRef<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  // Abandon telemetry: fires on unmount unless the flow completed.
  useEffect(() => {
    return () => {
      if (!completed.current) {
        trackGate("modal_abandon", { trigger, step: stepRef.current });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = useCallback(() => {
    if (stepRef.current !== "done") onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Deterministic unlock: a hard navigation re-runs middleware, server
  // renders, and client fetches with the new session cookie. Closing the
  // modal in place relied on useUser() flipping reactively, which left
  // truncated data on screen until a manual navigation.
  const finishAuth = useCallback(() => {
    completed.current = true;
    setStep("done");
    if (dest) window.location.assign(dest);
    else window.location.reload();
  }, [dest]);

  // ── Google: whole flow (sign-in or sign-up) handled via SSO redirect ──
  const submitGoogle = useCallback(async () => {
    if (!signIn || busy) return;
    setBusy(true);
    setError(null);
    const target =
      dest ?? window.location.pathname + window.location.search;
    completed.current = true; // leaving for Google isn't an abandon
    const { error: ssoError } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: target,
      redirectCallbackUrl: `/sso-callback?next=${encodeURIComponent(target)}`,
    });
    if (ssoError) {
      completed.current = false;
      setError(errMessage(ssoError as ClerkErrorLike, "Google sign-in did not start. Try again."));
      setBusy(false);
    }
    // On success the browser navigates away; stay busy until unload.
  }, [signIn, busy, dest]);

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
      } else if (isIdentifierExists(created.error as ClerkErrorLike)) {
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
      setCode("");
      triedCode.current = null;
      setResendIn(RESEND_SECONDS);
      setStep("code");
    } catch (e) {
      setError(errMessage(e as ClerkErrorLike, "We could not send the code. Check the address and try again."));
    } finally {
      setBusy(false);
    }
  }, [email, busy, signUp, signIn]);

  const resend = useCallback(async () => {
    if (!signUp || !signIn || busy || resendIn > 0) return;
    setError(null);
    const sent =
      mode === "signup"
        ? await signUp.verifications.sendEmailCode()
        : await signIn.emailCode.sendCode();
    if (sent.error) {
      setError(errMessage(sent.error as ClerkErrorLike, "We could not resend the code. Try again."));
      return;
    }
    setCode("");
    triedCode.current = null;
    setResendIn(RESEND_SECONDS);
    codeInput.current?.focus();
  }, [signUp, signIn, busy, resendIn, mode]);

  // ── Step 2: verify code, activate session, claim the handle, go ──
  const submitCode = useCallback(async () => {
    if (!signUp || !signIn || busy || code.length !== 6) return;
    triedCode.current = code;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const v = await signUp.verifications.verifyEmailCode({ code });
        if (v.error) throw v.error;
        let fin = await signUp.finalize();
        if (fin.error) {
          // Instance config may require a password even though this product is
          // passwordless (users sign in by email code). Satisfy it with a
          // random throwaway credential and retry once.
          const bytes = crypto.getRandomValues(new Uint8Array(24));
          const throwaway = btoa(String.fromCharCode(...bytes));
          const upd = await signUp.password({ password: throwaway });
          if (upd.error) throw fin.error; // surface the original, clearer error
          fin = await signUp.finalize();
          if (fin.error) throw fin.error;
        }
      } else {
        const v = await signIn.emailCode.verifyCode({ code });
        if (v.error) throw v.error;
        const fin = await signIn.finalize();
        if (fin.error) throw fin.error;
        // Returning user with a handle: straight through.
        const r = await fetch("/api/account/handle").then((x) => x.json()).catch(() => null);
        if (r?.handle) {
          trackGate("signup_complete", { trigger, step: "signin" });
          finishAuth();
          return;
        }
      }
      // New account (or a returning user who never claimed one): claim the
      // pre-filled handle without another step. A failed claim falls back to
      // the explicit handle step.
      const claimed = await claimHandle(handle);
      if (claimed) {
        trackGate("signup_complete", { trigger, step: mode });
        finishAuth();
      } else {
        setStep("handle");
      }
    } catch (e) {
      setError(errMessage(e as ClerkErrorLike, "That code did not match. Check the email and try again."));
      setCode("");
      codeInput.current?.focus();
    } finally {
      setBusy(false);
    }
  }, [busy, mode, code, handle, signUp, signIn, trigger, finishAuth]);

  // Auto-submit on the sixth digit (once per distinct code).
  useEffect(() => {
    if (step === "code" && code.length === 6 && !busy && triedCode.current !== code) {
      submitCode();
    }
  }, [step, code, busy, submitCode]);

  // Handle availability: while editing on the code step, or on the handle step.
  useEffect(() => {
    if (!handle || !(step === "handle" || (step === "code" && editingHandle))) return;
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
  }, [step, handle, editingHandle]);

  // ── Fallback step: explicit handle claim (OAuth arrivals, failed auto-claim) ──
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
      if (!res.ok) throw new Error(json?.error ?? "We could not save that handle. Try another.");
      trackGate("signup_complete", { trigger, step: mode });
      finishAuth();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [busy, handle, trigger, mode, finishAuth]);

  const headline = HEADLINES[trigger] ?? HEADLINES.header;
  const stepLabel =
    step === "email" ? "Step 1 of 2" : step === "code" ? "Step 2 of 2" : step === "done" ? "Signed in" : "Last step";

  const onHandleChange = (v: string) =>
    setHandle(v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20));

  const handleStatus =
    handleFree === false ? (
      <span className="label text-accent-red">Taken</span>
    ) : handleFree === true ? (
      <span className="label text-accent-green">Available</span>
    ) : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-3 pt-[12vh] sm:pt-3">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 bg-[oklch(8%_0.004_70/0.78)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gate-title"
        className="relative w-full max-w-[25rem] bg-background-subtle border border-accent-blue shadow-[0_24px_60px_-16px_oklch(0%_0_0/0.9)]"
      >
        <div className="panel-head">
          <span className="panel-title">{mode === "signin" && step !== "email" ? "Sign in" : "Account"}</span>
          <span className="panel-meta">{stepLabel}</span>
          {step !== "done" && (
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex-none -mr-1 grid place-items-center w-6 h-6 text-text-tertiary hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4">
          <h2 id="gate-title" className="cond font-bold text-[1.35rem] leading-tight text-text-primary">
            {step === "code"
              ? "Enter the 6-digit code"
              : step === "handle"
                ? HEADLINES.handle
                : step === "done"
                  ? "You are in"
                  : headline}
          </h2>

          {step === "email" && (
            <p className="text-sm text-text-secondary mt-1">
              Free account. No password, no card. About ten seconds.
            </p>
          )}

          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (step === "email") submitEmail();
              else if (step === "code") submitCode();
              else if (step === "handle") submitHandle();
            }}
          >
            {step === "email" && (
              <div className="space-y-2.5">
                {GOOGLE_AUTH_ENABLED && (
                  <>
                    <button
                      type="button"
                      onClick={submitGoogle}
                      disabled={busy}
                      className="btn btn-ghost w-full normal-case tracking-normal"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24z" />
                        <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11z" />
                        <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77z" />
                      </svg>
                      Continue with Google
                    </button>
                    <div className="flex items-center gap-3" aria-hidden="true">
                      <div className="h-px flex-1 bg-border" />
                      <span className="label">or</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}
                <label htmlFor="gate-email" className="label block">
                  Work email
                </label>
                <div className="flex">
                  <input
                    id="gate-email"
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@fund.com"
                    className="field h-10 border-r-0"
                  />
                  <button
                    type="submit"
                    disabled={busy || !email.includes("@")}
                    className="btn btn-primary h-10 flex-none"
                  >
                    {busy ? "Sending" : "Send code"}
                  </button>
                </div>
                {/* Clerk bot-protection mount: custom flows must provide this
                    element or Clerk falls back to its (unreliable) invisible
                    CAPTCHA. Renders empty unless a challenge is required. */}
                <div id="clerk-captcha" />
                <p className="text-xs text-text-tertiary">
                  Already have an account? Use the same email. We sign you in.
                </p>
              </div>
            )}

            {step === "code" && (
              <div className="space-y-3">
                <p className="text-sm text-text-secondary">
                  Sent to <span className="text-text-primary font-medium">{email.trim()}</span>.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1 text-accent-blue hover:underline"
                  >
                    <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                    Change
                  </button>
                </p>

                <div className="relative">
                  <input
                    ref={codeInput}
                    aria-label="6-digit code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    readOnly={busy}
                    value={code}
                    onFocus={() => setCodeFocused(true)}
                    onBlur={() => setCodeFocused(false)}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-text"
                  />
                  <div aria-hidden="true" className="grid grid-cols-6 gap-1.5 pointer-events-none">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const filled = i < code.length;
                      const caret = codeFocused && !busy && i === Math.min(code.length, 5);
                      return (
                        <div
                          key={i}
                          className={`h-12 grid place-items-center num text-[1.4rem] font-semibold bg-background border transition-colors duration-100 ${
                            caret ? "border-accent-blue" : filled ? "border-border-strong" : "border-border"
                          } ${busy ? "text-text-tertiary" : "text-text-primary"}`}
                        >
                          {code[i] ?? ""}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-text-tertiary" aria-live="polite">
                    {busy ? "Checking the code…" : "It submits on the sixth digit."}
                  </span>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resendIn > 0 || busy}
                    className="text-accent-blue hover:underline disabled:text-text-muted disabled:no-underline"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                  </button>
                </div>

                {mode === "signup" && (
                  <div className="border-t border-border pt-3">
                    {editingHandle ? (
                      <div>
                        <label htmlFor="gate-handle" className="label flex justify-between">
                          <span>Handle</span>
                          {handleStatus}
                        </label>
                        <div className="flex items-center mt-1.5">
                          <span className="h-8 px-2 grid place-items-center bg-background border border-r-0 border-border-strong num text-sm text-text-tertiary">
                            @
                          </span>
                          <input
                            id="gate-handle"
                            value={handle}
                            onChange={(e) => onHandleChange(e.target.value)}
                            maxLength={20}
                            className="field h-8 num text-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-text-tertiary">
                          Your handle <span className="num text-text-primary">@{handle}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingHandle(true)}
                          className="text-xs text-accent-blue hover:underline"
                        >
                          Edit
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === "handle" && (
              <div className="space-y-2.5">
                <label htmlFor="gate-handle-claim" className="label flex justify-between">
                  <span>Handle, 3–20 characters: a–z, 0–9, hyphens</span>
                  {handleStatus}
                </label>
                <div className="flex">
                  <span className="h-10 px-2.5 grid place-items-center bg-background border border-r-0 border-border-strong num text-sm text-text-tertiary">
                    @
                  </span>
                  <input
                    id="gate-handle-claim"
                    required
                    autoFocus
                    value={handle}
                    onChange={(e) => onHandleChange(e.target.value)}
                    maxLength={20}
                    className="field h-10 num border-r-0"
                  />
                  <button
                    type="submit"
                    disabled={busy || handle.length < 3 || handleFree === false}
                    className="btn btn-primary h-10 flex-none"
                  >
                    {busy ? "Saving" : "Continue"}
                  </button>
                </div>
              </div>
            )}

            {step === "done" && (
              <p className="text-sm text-text-secondary" aria-live="polite">
                Opening {dest ?? "the page"}…
              </p>
            )}

            {error && (
              <p role="alert" className="mt-3 text-sm text-accent-red">
                {error}
              </p>
            )}
          </form>
        </div>

        {step === "email" && (
          <p className="px-4 py-2.5 border-t border-border text-[0.7rem] leading-relaxed text-text-muted">
            By continuing you agree to the Terms and Privacy Policy.
          </p>
        )}
      </div>
    </div>
  );
}

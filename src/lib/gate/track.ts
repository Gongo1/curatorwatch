"use client";

// Gate funnel telemetry. sendBeacon so events survive navigation; fire-and-forget.
export type GateEventName =
  | "gate_impression"
  | "gate_click"
  | "modal_open"
  | "modal_abandon"
  | "signup_complete"
  | "unlock_engagement"
  | "alert_optin_post_signup";

export function trackGate(
  event: GateEventName,
  props: { surface?: string; trigger?: string; step?: string } = {}
): void {
  try {
    const body = JSON.stringify({ event, ...props });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track-gate", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track-gate", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Telemetry must never break the product.
  }
}

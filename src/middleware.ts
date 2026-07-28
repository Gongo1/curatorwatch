import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Clerk session middleware — attaches auth context so route handlers can call
// auth() (used by the account-gate API truncation). It protects nothing by
// itself: every route stays publicly reachable; gating decisions happen in the
// handlers. When the gate flag is off (or keys are absent) this is a pure
// pass-through, so crons and the existing public API are untouched.
const gateEnabled =
  process.env.NEXT_PUBLIC_FEATURE_ACCOUNT_GATE === "true" &&
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default gateEnabled ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    // All routes except static assets and Next internals.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

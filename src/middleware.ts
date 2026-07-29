import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Hard account wall: anonymous users see the home page (top-3 ranking), docs,
// and changelog — nothing else. Every other page redirects to home with the
// create-account/sign-in modal auto-opened (?join=1); every other API returns
// 401. Signed-in requests pass straight through. When the gate flag is off (or
// keys are absent) this is a pure pass-through, so the dark path is unchanged.
const gateEnabled =
  process.env.NEXT_PUBLIC_FEATURE_ACCOUNT_GATE === "true" &&
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const isPublic = createRouteMatcher([
  "/",
  "/docs(.*)",
  "/changelog(.*)",
  "/robots.txt",
  "/sitemap(.*)",
  "/api/dashboard", // anonymous responses are truncated inside the route
  "/api/stats/aum-growth", // home TVL chart (aggregate top-6 series — part of the public shop window)
  "/api/track-gate",
  "/api/account(.*)",
  "/api/cron(.*)", // secret-protected, sessionless — must never be walled
  "/api/health",
]);

export default gateEnabled
  ? clerkMiddleware(async (auth, req) => {
      if (isPublic(req)) return;
      const { userId } = await auth();
      if (userId) return;
      if (req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "account_required" },
          { status: 401 }
        );
      }
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "?join=1";
      return NextResponse.redirect(url);
    })
  : () => NextResponse.next();

export const config = {
  matcher: [
    // All routes except static assets and Next internals.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

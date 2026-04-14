"use client";

import { useState, useEffect } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import { X } from "lucide-react";

const DISMISS_KEY = "joinBannerDismissed";

export function JoinBanner() {
  const { user, isLoaded } = useUser();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (!isLoaded || user || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="flex items-center justify-center gap-3 bg-accent-blue/10 border-b border-accent-blue/20 px-4 py-2">
      <p className="text-sm text-text-secondary">
        Get instant alerts when vault TVL drops or APY changes
      </p>
      <SignInButton mode="modal">
        <button className="shrink-0 rounded-md bg-accent-blue px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-accent-blue-hover">
          Sign Up Free &rarr;
        </button>
      </SignInButton>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-0.5 text-text-muted transition-colors hover:text-text-primary"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

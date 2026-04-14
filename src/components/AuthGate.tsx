"use client";

import { useUser, SignInButton } from "@clerk/nextjs";

interface AuthGateProps {
  message: string;
  children: React.ReactNode;
}

export function AuthGate({ message, children }: AuthGateProps) {
  const { user } = useUser();

  if (user) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
        <p className="mb-3 text-sm font-medium text-text-primary">{message}</p>
        <SignInButton mode="modal">
          <button className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-blue-hover">
            Sign In Free
          </button>
        </SignInButton>
      </div>
    </div>
  );
}

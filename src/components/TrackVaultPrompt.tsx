"use client";

import { SignInButton } from "@clerk/nextjs";
import { X } from "lucide-react";

interface TrackVaultPromptProps {
  name: string;
  type: "vault" | "curator";
  open: boolean;
  onClose: () => void;
}

export function TrackVaultPrompt({ name, type, open, onClose }: TrackVaultPromptProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background-elevated p-6 shadow-xl mx-4">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-muted hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-bold text-text-primary mb-1">
          Track {name}
        </h2>
        <p className="text-sm text-text-secondary mb-5">
          Sign in to start tracking this {type} and get notified of changes.
        </p>

        {/* Benefits */}
        <ul className="space-y-2.5 mb-6">
          <li className="flex items-start gap-2.5 text-sm text-text-secondary">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Get alerts when TVL drops &gt;10%
          </li>
          <li className="flex items-start gap-2.5 text-sm text-text-secondary">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Notified when APY changes &gt;20%
          </li>
          <li className="flex items-start gap-2.5 text-sm text-text-secondary">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Track governance and config changes
          </li>
        </ul>

        {/* Social proof */}
        <p className="text-xs text-text-muted mb-5 text-center">
          1,200+ users tracking $2.5B in vaults
        </p>

        {/* CTA */}
        <SignInButton mode="modal">
          <button className="w-full rounded-lg bg-accent-blue py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-blue-hover">
            Continue with Email
          </button>
        </SignInButton>
      </div>
    </div>
  );
}

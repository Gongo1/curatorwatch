"use client";

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
          Tracking for this {type} is not yet available without an account.
        </p>

        <button
          onClick={onClose}
          className="w-full rounded-lg bg-accent-blue py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-blue-hover"
        >
          Close
        </button>
      </div>
    </div>
  );
}

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
      <div className="absolute inset-0 bg-background/80" onClick={onClose} />

      {/* Modal */}
      <div role="dialog" aria-modal="true" aria-labelledby="track-prompt-title" className="panel relative w-full max-w-md mx-4">
        <div className="panel-head">
          <h2 id="track-prompt-title" className="panel-title truncate">
            Track {name}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto text-text-tertiary hover:text-accent-blue transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-3">
          <p className="text-sm text-text-secondary mb-3">
            Tracking for this {type} is not yet available without an account.
          </p>
          <button onClick={onClose} className="btn btn-primary w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

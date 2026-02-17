'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyAddressProps {
  address: string;
  truncate?: boolean;
  className?: string;
  showFull?: boolean;
}

export function CopyAddress({
  address,
  truncate = true,
  className = '',
  showFull = false
}: CopyAddressProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayAddress = truncate && !showFull
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <code className="text-sm font-mono text-text-secondary">{displayAddress}</code>
      <button
        onClick={handleCopy}
        className="p-1 hover:bg-background-elevated rounded transition-colors"
        title={copied ? "Copied!" : "Copy address"}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-accent-green" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-text-muted hover:text-text-secondary" />
        )}
      </button>
    </div>
  );
}

// For displaying curator name with fallback to address
export function CuratorName({
  name,
  address,
  showCopy = true,
  className = ''
}: {
  name: string | null;
  address: string;
  showCopy?: boolean;
  className?: string;
}) {
  const displayName = name && name !== 'Unknown' && name !== 'Unknown Curator'
    ? name
    : `Curator ${address.slice(0, 6)}...${address.slice(-4)}`;

  const isAddress = !name || name === 'Unknown' || name === 'Unknown Curator';

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} title={address}>
      <span className={isAddress ? 'font-mono text-text-secondary' : ''}>
        {displayName}
      </span>
      {showCopy && (
        <CopyAddressButton address={address} />
      )}
    </div>
  );
}

// Standalone copy button for use in tables etc.
export function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-background-elevated rounded transition-colors"
      title={copied ? "Copied!" : "Copy address"}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-accent-green" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-text-muted hover:text-text-secondary" />
      )}
    </button>
  );
}

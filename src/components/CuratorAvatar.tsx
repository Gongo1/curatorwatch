"use client";

import { useState } from "react";

interface CuratorAvatarProps {
  address: string;
  name?: string | null;
  logoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

// Get size classes
function getSizeClasses(size: CuratorAvatarProps["size"]) {
  switch (size) {
    case "xs":
      return { container: "w-6 h-6", text: "text-[0.65rem]" };
    case "sm":
      return { container: "w-8 h-8", text: "text-xs" };
    case "md":
      return { container: "w-10 h-10", text: "text-sm" };
    case "lg":
      return { container: "w-12 h-12", text: "text-base" };
    case "xl":
      return { container: "w-16 h-16", text: "text-lg" };
    default:
      return { container: "w-10 h-10", text: "text-sm" };
  }
}

// Get initials from name
function getInitials(name: string | null | undefined): string {
  if (!name) return "?";

  // Handle addresses
  if (name.startsWith("0x")) {
    return name.slice(2, 4).toUpperCase();
  }

  // Split by spaces and get first letter of each word
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + (words[1]?.[0] || "")).toUpperCase();
}

// Square tile, amber initials on the elevated ground (the terminal avatar).
// `address` stays in the props for callers; the tile no longer derives a color from it.
export function CuratorAvatar({
  name,
  logoUrl,
  size = "md",
  className = "",
}: CuratorAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const sizeClasses = getSizeClasses(size);
  const initials = getInitials(name);

  // If we have a valid logo URL and image hasn't errored
  if (logoUrl && !imageError) {
    return (
      <div className={`${sizeClasses.container} overflow-hidden flex-shrink-0 bg-background-elevated ${className}`}>
        <img
          src={logoUrl}
          alt={name || "Curator"}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // Fallback: initials tile
  return (
    <div
      className={`${sizeClasses.container} bg-background-elevated border border-border flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <span className={`${sizeClasses.text} cond font-bold text-accent-blue`}>
        {initials}
      </span>
    </div>
  );
}

// Static version without image loading (for server components or when logo is known to be absent)
export function CuratorAvatarFallback({
  name,
  size = "md",
  className = "",
}: Omit<CuratorAvatarProps, "logoUrl">) {
  const sizeClasses = getSizeClasses(size);
  const initials = getInitials(name);

  return (
    <div
      className={`${sizeClasses.container} bg-background-elevated border border-border flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <span className={`${sizeClasses.text} cond font-bold text-accent-blue`}>
        {initials}
      </span>
    </div>
  );
}

"use client";

import { useState } from "react";

interface CuratorAvatarProps {
  address: string;
  name?: string | null;
  logoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

// Generate deterministic gradient colors from address
function getAddressGradient(address: string): { from: string; to: string } {
  const gradients = [
    { from: "from-blue-500", to: "to-cyan-400" },
    { from: "from-purple-500", to: "to-pink-400" },
    { from: "from-emerald-500", to: "to-teal-400" },
    { from: "from-amber-500", to: "to-orange-400" },
    { from: "from-rose-500", to: "to-red-400" },
    { from: "from-indigo-500", to: "to-violet-400" },
    { from: "from-sky-500", to: "to-blue-400" },
    { from: "from-fuchsia-500", to: "to-purple-400" },
    { from: "from-lime-500", to: "to-green-400" },
    { from: "from-pink-500", to: "to-rose-400" },
  ];

  // Use first 4 hex chars after 0x to generate index
  const index = parseInt(address.slice(2, 6), 16) % gradients.length;
  return gradients[index];
}

// Get size classes
function getSizeClasses(size: CuratorAvatarProps["size"]) {
  switch (size) {
    case "xs":
      return { container: "w-6 h-6", text: "text-xs", rounded: "rounded-md" };
    case "sm":
      return { container: "w-8 h-8", text: "text-sm", rounded: "rounded-lg" };
    case "md":
      return { container: "w-10 h-10", text: "text-base", rounded: "rounded-lg" };
    case "lg":
      return { container: "w-12 h-12", text: "text-lg", rounded: "rounded-xl" };
    case "xl":
      return { container: "w-16 h-16", text: "text-xl", rounded: "rounded-xl" };
    default:
      return { container: "w-10 h-10", text: "text-base", rounded: "rounded-lg" };
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

export function CuratorAvatar({
  address,
  name,
  logoUrl,
  size = "md",
  className = "",
}: CuratorAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const gradient = getAddressGradient(address);
  const sizeClasses = getSizeClasses(size);
  const initials = getInitials(name);

  // If we have a valid logo URL and image hasn't errored
  if (logoUrl && !imageError) {
    return (
      <div className={`${sizeClasses.container} ${sizeClasses.rounded} overflow-hidden flex-shrink-0 ${className}`}>
        <img
          src={logoUrl}
          alt={name || "Curator"}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // Fallback to gradient avatar
  return (
    <div
      className={`${sizeClasses.container} ${sizeClasses.rounded} bg-gradient-to-br ${gradient.from} ${gradient.to} flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <span className={`${sizeClasses.text} font-bold text-white drop-shadow-sm`}>
        {initials}
      </span>
    </div>
  );
}

// Static version without image loading (for server components or when logo is known to be absent)
export function CuratorAvatarFallback({
  address,
  name,
  size = "md",
  className = "",
}: Omit<CuratorAvatarProps, "logoUrl">) {
  const gradient = getAddressGradient(address);
  const sizeClasses = getSizeClasses(size);
  const initials = getInitials(name);

  return (
    <div
      className={`${sizeClasses.container} ${sizeClasses.rounded} bg-gradient-to-br ${gradient.from} ${gradient.to} flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <span className={`${sizeClasses.text} font-bold text-white drop-shadow-sm`}>
        {initials}
      </span>
    </div>
  );
}

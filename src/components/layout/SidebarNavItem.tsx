"use client";

import Link from "next/link";

interface SidebarNavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
}

export function SidebarNavItem({
  href,
  icon,
  label,
  active,
  badge,
}: SidebarNavItemProps) {
  return (
    <Link
      href={href}
      prefetch={true}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
        active
          ? "bg-background-elevated text-text-primary font-semibold"
          : "text-text-secondary font-medium hover:text-text-primary hover:bg-background-hover"
      }`}
    >
      <span className="flex-shrink-0 w-5 h-5">{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
      {badge !== undefined && badge > 0 ? (
        <span className="ml-auto min-w-[18px] h-[18px] px-1.5 flex items-center justify-center rounded-md text-[10px] font-semibold tabular-nums bg-background-hover text-text-secondary">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : (
        active && (
          <span
            className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-blue"
            aria-hidden="true"
          />
        )
      )}
    </Link>
  );
}

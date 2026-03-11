"use client";

import Link from "next/link";

interface SidebarNavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  badge?: number;
}

export function SidebarNavItem({
  href,
  icon,
  label,
  active,
  collapsed,
  badge,
}: SidebarNavItemProps) {
  return (
    <Link
      href={href}
      prefetch={true}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 relative group ${
        active
          ? "bg-accent-blue/10 text-accent-blue"
          : "text-text-secondary hover:text-text-primary hover:bg-background-hover"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent-blue rounded-r" />
      )}
      <span className="flex-shrink-0 w-5 h-5">{icon}</span>
      <span
        className={`whitespace-nowrap transition-opacity duration-200 ${
          collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
        }`}
      >
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`flex-shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold bg-accent-red text-white transition-opacity duration-200 ${
            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          }`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

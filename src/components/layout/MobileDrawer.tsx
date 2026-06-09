"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Users,
  TrendingUp,
  Coins,
  Zap,
  Calculator,
  Bell,
  BookOpen,
  FileText,
  X,
} from "lucide-react";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();

  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const navItems = [
    { href: "/", icon: <Users className="w-5 h-5" />, label: "Curators", section: "Intelligence" },
    { href: "/yields", icon: <TrendingUp className="w-5 h-5" />, label: "Yields", section: "Lenses" },
    { href: "/fees", icon: <Coins className="w-5 h-5" />, label: "Fees", section: "Lenses" },
    { href: "/liquidations", icon: <Zap className="w-5 h-5" />, label: "Liquidations", section: "Lenses" },
    { href: "/calculator", icon: <Calculator className="w-5 h-5" />, label: "LP Calculator", section: "Lenses" },
    { href: "/alerts", icon: <Bell className="w-5 h-5" />, label: "Alerts", section: "Monitor" },
    { href: "/changelog", icon: <BookOpen className="w-5 h-5" />, label: "Changelog", section: "Monitor" },
    { href: "/docs", icon: <FileText className="w-5 h-5" />, label: "Docs", section: "Monitor" },
  ];

  // Group by section
  const sections = navItems.reduce<Record<string, typeof navItems>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-background-subtle border-r border-border transform transition-transform duration-200 ease-in-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
            <Image
              src="/logo.png"
              alt="CuratorWatch"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="text-sm font-bold text-text-primary">
              CuratorWatch
            </span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                {section}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onClick={onClose}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "bg-background-elevated text-text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-background-hover"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
            <span className="text-xs text-text-tertiary">Live</span>
          </div>
        </div>
      </div>
    </>
  );
}

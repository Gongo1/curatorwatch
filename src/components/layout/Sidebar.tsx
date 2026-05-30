"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SidebarNavItem } from "./SidebarNavItem";
import {
  Users,
  Box,
  TrendingUp,
  Coins,
  Zap,
  Bell,
  BookOpen,
  Calculator,
  FileText,
} from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    async function fetchAlertCount() {
      try {
        const res = await fetch("/api/changes?hours=24&limit=0");
        const data = await res.json();
        if (data.success) {
          setAlertCount(data.data.summary.total);
        }
      } catch {
        // silent fail
      }
    }
    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Curator-first IA: Curators leads; vaults/economics are lenses applied to them.
  const sections = [
    {
      title: "Intelligence",
      items: [
        { href: "/", icon: <Users className="w-5 h-5" />, label: "Curators" },
      ],
    },
    {
      title: "Lenses",
      items: [
        { href: "/vaults", icon: <Box className="w-5 h-5" />, label: "Vaults" },
        { href: "/yields", icon: <TrendingUp className="w-5 h-5" />, label: "Yields" },
        { href: "/fees", icon: <Coins className="w-5 h-5" />, label: "Fees" },
        { href: "/liquidations", icon: <Zap className="w-5 h-5" />, label: "Liquidations" },
        { href: "/calculator", icon: <Calculator className="w-5 h-5" />, label: "LP Calculator" },
      ],
    },
    {
      title: "Monitor",
      items: [
        { href: "/alerts", icon: <Bell className="w-5 h-5" />, label: "Alerts", badge: alertCount },
        { href: "/changelog", icon: <BookOpen className="w-5 h-5" />, label: "Changelog" },
        { href: "/docs", icon: <FileText className="w-5 h-5" />, label: "Docs" },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden lg:flex flex-col h-screen sticky top-0 w-[224px] border-r border-border bg-background">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <Image
            src="/logo.png"
            alt="CuratorWatch"
            width={26}
            height={26}
            className="rounded-lg flex-shrink-0"
          />
          <span className="text-sm font-semibold text-text-primary font-mono tracking-tight whitespace-nowrap">
            CuratorWatch
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary font-mono">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={item.label}
                  active={isActive(item.href)}
                  badge={"badge" in item ? item.badge : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Data freshness — the single live indicator */}
      <div className="px-4 py-3.5 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-text-tertiary font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green flex-shrink-0" />
          <span>Live · updated every 6h</span>
        </div>
      </div>
    </aside>
  );
}

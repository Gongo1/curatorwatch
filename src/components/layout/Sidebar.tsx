"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SidebarNavItem } from "./SidebarNavItem";
import {
  LayoutDashboard,
  Box,
  TrendingUp,
  Coins,
  Zap,
  Bell,
  BookOpen,
  Calculator,
  FileText,
  UserCircle,
} from "lucide-react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

interface SidebarProps {
  collapsed: boolean;
}

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
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

  const sections = [
    {
      title: "Analytics",
      items: [
        {
          href: "/",
          icon: <LayoutDashboard className="w-5 h-5" />,
          label: "Dashboard",
        },
        {
          href: "/vaults",
          icon: <Box className="w-5 h-5" />,
          label: "Vaults",
        },
      ],
    },
    {
      title: "Economics",
      items: [
        {
          href: "/yields",
          icon: <TrendingUp className="w-5 h-5" />,
          label: "Yields",
        },
        {
          href: "/fees",
          icon: <Coins className="w-5 h-5" />,
          label: "Fees",
        },
        {
          href: "/liquidations",
          icon: <Zap className="w-5 h-5" />,
          label: "Liquidations",
        },
        {
          href: "/calculator",
          icon: <Calculator className="w-5 h-5" />,
          label: "LP Calculator",
        },
      ],
    },
    {
      title: "Monitoring",
      items: [
        {
          href: "/alerts",
          icon: <Bell className="w-5 h-5" />,
          label: "Alerts",
          badge: alertCount,
        },
      ],
    },
    {
      title: "Info",
      items: [
        {
          href: "/changelog",
          icon: <BookOpen className="w-5 h-5" />,
          label: "Changelog",
        },
        {
          href: "/docs",
          icon: <FileText className="w-5 h-5" />,
          label: "Docs",
        },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`hidden lg:flex flex-col h-screen sticky top-0 border-r border-border bg-background-subtle transition-all duration-200 ease-in-out ${
        collapsed ? "w-14" : "w-[220px]"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <Image
            src="/logo.png"
            alt="CuratorWatch"
            width={28}
            height={28}
            className="rounded-lg flex-shrink-0"
          />
          <span
            className={`text-sm font-bold text-text-primary whitespace-nowrap transition-opacity duration-200 ${
              collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
            }`}
          >
            CuratorWatch
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            <p
              className={`px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted transition-opacity duration-200 ${
                collapsed ? "opacity-0" : "opacity-100"
              }`}
            >
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
                  collapsed={collapsed}
                  badge={"badge" in item ? item.badge : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Auth & Live Status */}
      <div className="px-3 py-3 border-t border-border">
        {user ? (
          <div className="flex items-center gap-2">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-7 h-7",
                },
              }}
            />
            <span
              className={`flex items-center gap-1.5 transition-opacity duration-200 ${
                collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green flex-shrink-0" />
              <span className="text-xs text-text-tertiary">Live</span>
            </span>
          </div>
        ) : (
          <SignInButton mode="modal">
            {collapsed ? (
              <button className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-hover transition-colors">
                <UserCircle className="w-5 h-5" />
              </button>
            ) : (
              <button className="w-full px-3 py-1.5 text-sm font-medium rounded-lg bg-accent-blue text-white hover:bg-accent-blue-hover transition-colors">
                Sign In
              </button>
            )}
          </SignInButton>
        )}
      </div>
    </aside>
  );
}

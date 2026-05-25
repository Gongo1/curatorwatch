"use client";

import { useState, useCallback } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MobileDrawer } from "./MobileDrawer";
import { Footer } from "./Footer";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
      >
        <Sidebar collapsed={!sidebarHovered} />
      </div>

      {/* Mobile Drawer */}
      <MobileDrawer open={drawerOpen} onClose={closeDrawer} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-border bg-background-subtle">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background-hover transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-text-primary">
              CuratorWatch
            </span>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 px-4 sm:px-6 py-4 sm:py-5 max-w-[1400px] w-full mx-auto">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
}

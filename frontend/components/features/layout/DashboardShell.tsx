"use client";

import { useState } from "react";
import { Header } from "@/components/features/layout/Header";
import { MobileSidebar } from "@/components/features/layout/MobileSidebar";
import { Sidebar } from "@/components/features/layout/Sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} />
      </div>

      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          onCollapseClick={() => setCollapsed((v) => !v)}
          sidebarCollapsed={collapsed}
          showCollapse
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>

        <footer className="border-t border-border bg-card px-6 py-3">
          <p className="text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} NOOR ERP · Business Operations Platform
            for Oman &amp; GCC
          </p>
        </footer>
      </div>
    </div>
  );
}

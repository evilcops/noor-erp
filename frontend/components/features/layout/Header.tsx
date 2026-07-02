"use client";

import { Menu, PanelLeftClose, PanelLeft } from "lucide-react";
import { BranchSelector } from "@/components/features/layout/BranchSelector";
import { ModuleTabs } from "@/components/features/layout/ModuleTabs";
import { NotificationBell } from "@/components/common/NotificationBell";
import { UserMenu } from "@/components/common/UserMenu";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick: () => void;
  onCollapseClick?: () => void;
  sidebarCollapsed?: boolean;
  showCollapse?: boolean;
}

export function Header({
  onMenuClick,
  onCollapseClick,
  sidebarCollapsed = false,
  showCollapse = false,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-header px-4 lg:px-6">
      <button
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {showCollapse && onCollapseClick ? (
        <button
          onClick={onCollapseClick}
          className="hidden h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      ) : null}

      <div className={cn("flex min-w-0 flex-1 items-center gap-3")}>
        <div className="hidden sm:block">
          <BranchSelector />
        </div>
        <div className="sm:hidden">
          <BranchSelector compact />
        </div>
        <ModuleTabs />
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}

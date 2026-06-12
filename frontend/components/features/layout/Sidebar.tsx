"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV, SETTINGS_NAV, isNavActive } from "@/config/site";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
}

export function Sidebar({ onNavigate, collapsed = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href="/" className="flex items-center gap-3" onClick={onNavigate}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-foreground">
            N
          </div>
          {!collapsed ? (
            <div>
              <p className="text-sm font-semibold text-foreground">NOOR ERP</p>
              <p className="text-[11px] text-muted-foreground">People · Phase 1</p>
            </div>
          ) : null}
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div>
          {!collapsed ? (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Main
            </p>
          ) : null}
          <ul className="space-y-1">
            {MAIN_NAV.map((item) => {
              const active = isNavActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-active text-sidebar-active-foreground"
                        : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-brand")} />
                    {!collapsed ? <span>{item.title}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          {!collapsed ? (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Settings
            </p>
          ) : null}
          <ul className="space-y-1">
            {SETTINGS_NAV.map((item) => {
              const active = isNavActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.title : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-active text-sidebar-active-foreground"
                        : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-brand")} />
                    {!collapsed ? <span>{item.title}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {!collapsed ? (
        <div className="border-t border-border p-4">
          <p className="text-xs text-muted-foreground">NOOR ERP v0.1</p>
          <p className="text-[11px] text-muted-foreground">Oman &amp; GCC</p>
        </div>
      ) : null}
    </aside>
  );
}

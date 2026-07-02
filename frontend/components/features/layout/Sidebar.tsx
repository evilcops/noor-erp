"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV, SETTINGS_NAV, SUPPLY_NAV, isNavActive } from "@/config/site";
import { MODULE_SIDEBAR_LABELS } from "@/config/modules";
import { useErpModule } from "@/components/providers/ModuleProvider";
import { useAuth } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { isEmployeeRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
}

function filterNav<T extends { permission?: string }>(
  items: T[],
  can: (permission: string) => boolean
): T[] {
  return items.filter((item) => !item.permission || can(item.permission));
}

function NavSection({
  items,
  pathname,
  collapsed,
  employeeView,
  onNavigate,
  sectionLabel,
}: {
  items: typeof MAIN_NAV;
  pathname: string;
  collapsed: boolean;
  employeeView: boolean;
  onNavigate?: () => void;
  sectionLabel: string;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      {!collapsed ? (
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {sectionLabel}
        </p>
      ) : null}
      <ul className="space-y-1">
        {items.map((item) => {
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
                {!collapsed ? (
                  <span>{employeeView && item.employeeTitle ? item.employeeTitle : item.title}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Sidebar({ onNavigate, collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { activeModule } = useErpModule();
  const employeeView = isEmployeeRole(user);

  const moduleNav = filterNav(activeModule === "inventory" ? SUPPLY_NAV : MAIN_NAV, can);
  const settingsNav = filterNav(SETTINGS_NAV, can);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href={activeModule === "inventory" ? "/supply" : "/"} className="flex items-center gap-3" onClick={onNavigate}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-foreground">
            N
          </div>
          {!collapsed ? (
            <div>
              <p className="text-sm font-semibold text-foreground">NOOR ERP</p>
              <p className="text-[11px] text-muted-foreground">{MODULE_SIDEBAR_LABELS[activeModule]}</p>
            </div>
          ) : null}
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <NavSection
          items={moduleNav}
          pathname={pathname}
          collapsed={collapsed}
          employeeView={employeeView}
          onNavigate={onNavigate}
          sectionLabel={activeModule === "inventory" ? "Inventory" : "Main"}
        />

        <NavSection
          items={settingsNav}
          pathname={pathname}
          collapsed={collapsed}
          employeeView={employeeView}
          onNavigate={onNavigate}
          sectionLabel="Settings"
        />
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

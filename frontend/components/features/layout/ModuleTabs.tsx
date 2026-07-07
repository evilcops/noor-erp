"use client";

import { Briefcase, Warehouse, Bike } from "lucide-react";
import { MAIN_NAV, SUPPLY_NAV, RIDERS_NAV } from "@/config/site";
import { MODULE_LABELS, getModuleDefaultPath, type ErpModule } from "@/config/modules";
import { useErpModule } from "@/components/providers/ModuleProvider";
import { useAuth } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { isRiderRole } from "@/lib/permissions";
import type { NavItem } from "@/config/site";
import type { UserRole } from "@/types/auth-user";
import { cn } from "@/lib/utils";

function filterNav(
  items: NavItem[],
  can: (permission: string) => boolean,
  userRole?: UserRole
): NavItem[] {
  return items.filter((item) => {
    if (item.roles?.length) {
      return userRole ? item.roles.includes(userRole) : false;
    }
    if (item.permission && !can(item.permission)) return false;
    return true;
  });
}

const TAB_CONFIG: { id: ErpModule; icon: typeof Briefcase }[] = [
  { id: "hr", icon: Briefcase },
  { id: "inventory", icon: Warehouse },
  { id: "riders", icon: Bike },
];

function getNavForModule(module: ErpModule) {
  if (module === "inventory") return SUPPLY_NAV;
  if (module === "riders") return RIDERS_NAV;
  return MAIN_NAV;
}

export function ModuleTabs() {
  const { activeModule, setActiveModule } = useErpModule();
  const { user } = useAuth();
  const { can } = usePermissions();

  if (isRiderRole(user)) {
    return (
      <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1">
        <div className="flex items-center gap-2 rounded-md bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm">
          <Bike className="h-4 w-4 text-brand" />
          <span className="hidden sm:inline">{MODULE_LABELS.riders}</span>
        </div>
      </div>
    );
  }

  const visibleTabs = TAB_CONFIG.filter((tab) => {
    const nav = getNavForModule(tab.id);
    return filterNav(nav, can, user?.role).length > 0;
  });

  if (visibleTabs.length <= 1) return null;

  return (
    <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1">
      {visibleTabs.map(({ id, icon: Icon }) => {
        const active = activeModule === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setActiveModule(id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
          >
            <Icon className={cn("h-4 w-4", active && "text-brand")} />
            <span className="hidden sm:inline">{MODULE_LABELS[id]}</span>
          </button>
        );
      })}
    </div>
  );
}

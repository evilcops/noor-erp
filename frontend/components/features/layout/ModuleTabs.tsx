"use client";

import { Briefcase, Warehouse } from "lucide-react";
import { MAIN_NAV, SUPPLY_NAV } from "@/config/site";
import { MODULE_LABELS, type ErpModule } from "@/config/modules";
import { useErpModule } from "@/components/providers/ModuleProvider";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

function filterNav<T extends { permission?: string }>(
  items: T[],
  can: (permission: string) => boolean
): T[] {
  return items.filter((item) => !item.permission || can(item.permission));
}

const TAB_CONFIG: { id: ErpModule; icon: typeof Briefcase }[] = [
  { id: "hr", icon: Briefcase },
  { id: "inventory", icon: Warehouse },
];

export function ModuleTabs() {
  const { activeModule, setActiveModule } = useErpModule();
  const { can } = usePermissions();

  const visibleTabs = TAB_CONFIG.filter((tab) => {
    const nav = tab.id === "hr" ? MAIN_NAV : SUPPLY_NAV;
    return filterNav(nav, can).length > 0;
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

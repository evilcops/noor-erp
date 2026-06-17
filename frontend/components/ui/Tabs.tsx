"use client";

import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  errorCount?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-border", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === tab.id
              ? "border-brand text-brand"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
          {tab.errorCount ? (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {tab.errorCount}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

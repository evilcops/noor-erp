"use client";

import { Building2, ChevronDown, GitBranch } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { useBranch } from "@/hooks";
import { cn } from "@/lib/utils";

interface BranchSelectorProps {
  compact?: boolean;
}

export function BranchSelector({ compact = false }: BranchSelectorProps) {
  const {
    mainBranches,
    activeMainBranchId,
    activeSubBranchId,
    activeSubBranches,
    setActiveMainBranchId,
    setActiveSubBranchId,
    isLoading,
  } = useBranch();

  const activeMain = mainBranches.find((b) => b._id === activeMainBranchId);
  const activeSub = activeSubBranches.find((b) => b._id === activeSubBranchId);

  if (isLoading || !activeMain || mainBranches.length === 0) return null;

  const subLabel = activeSub?.name ?? "Main branch";

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
              compact ? "max-w-[140px]" : "max-w-[200px]"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-muted">
              <Building2 className="h-4 w-4 text-brand" />
            </div>
            {!compact ? (
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{activeMain.name}</p>
                <p className="truncate text-xs text-muted-foreground">{activeMain.code}</p>
              </div>
            ) : (
              <span className="truncate text-xs font-medium">{activeMain.code}</span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Branch</DropdownMenuLabel>
          {mainBranches.map((br) => (
            <DropdownMenuItem
              key={br._id}
              onClick={() => {
                setActiveMainBranchId(br._id);
                toast.success(`Branch: ${br.name}`);
              }}
              className={cn(activeMainBranchId === br._id && "bg-brand-muted text-brand")}
            >
              <Building2 className="h-4 w-4" />
              <div>
                <p>{br.name}</p>
                <p className="text-xs text-muted-foreground">{br.code}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
              compact ? "max-w-[140px]" : "max-w-[200px]"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </div>
            {!compact ? (
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{subLabel}</p>
                <p className="truncate text-xs text-muted-foreground">Sub-branch</p>
              </div>
            ) : (
              <span className="truncate text-xs font-medium">
                {activeSub?.code ?? "Main"}
              </span>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Sub-branch</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              setActiveSubBranchId("");
              toast.success(`Sub-branch: ${activeMain.name} (main)`);
            }}
            className={cn(!activeSubBranchId && "bg-brand-muted text-brand")}
          >
            <GitBranch className="h-4 w-4" />
            <div>
              <p>Main branch</p>
              <p className="text-xs text-muted-foreground">{activeMain.name}</p>
            </div>
          </DropdownMenuItem>
          {activeSubBranches.length > 0 ? <DropdownMenuSeparator /> : null}
          {activeSubBranches.map((br) => (
            <DropdownMenuItem
              key={br._id}
              onClick={() => {
                setActiveSubBranchId(br._id);
                toast.success(`Sub-branch: ${br.name}`);
              }}
              className={cn(activeSubBranchId === br._id && "bg-brand-muted text-brand")}
            >
              <GitBranch className="h-4 w-4" />
              <div>
                <p>{br.name}</p>
                <p className="text-xs text-muted-foreground">{br.code}</p>
              </div>
            </DropdownMenuItem>
          ))}
          {activeSubBranches.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No sub-branches for this branch</p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

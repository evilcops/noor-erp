"use client";

import { Building2, ChevronDown, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { useBranch } from "@/hooks";
import { cn } from "@/lib/utils";

interface BranchSelectorProps {
  compact?: boolean;
}

export function BranchSelector({ compact = false }: BranchSelectorProps) {
  const { branches, activeBranchId, setActiveBranchId } = useBranch();

  const activeBranch = branches.find((b) => b._id === activeBranchId);

  if (!activeBranch || branches.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
            compact ? "max-w-[180px]" : "max-w-[280px]"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-muted">
            <Building2 className="h-4 w-4 text-brand" />
          </div>
          {!compact ? (
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{activeBranch.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {activeBranch.code}{activeBranch.address ? ` · ${activeBranch.address}` : ""}
              </p>
            </div>
          ) : (
            <span className="truncate text-xs font-medium">{activeBranch.code}</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Select branch</DropdownMenuLabel>
        {branches.map((br) => (
          <DropdownMenuItem
            key={br._id}
            onClick={() => {
              setActiveBranchId(br._id);
              toast.success(`Now viewing ${br.name}`);
            }}
            className={cn(activeBranchId === br._id && "bg-brand-muted text-brand")}
          >
            <MapPin className="h-4 w-4" />
            <div>
              <p>{br.name}</p>
              <p className="text-xs text-muted-foreground">
                {br.code}{br.address ? ` · ${br.address}` : ""}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

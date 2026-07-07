"use client";

import { Select } from "@/components/ui/Select";
import type { Branch } from "@/types/branch";
import { effectiveBranchId, mainBranches, subBranchesOf } from "@/lib/branch-utils";
import { cn } from "@/lib/utils";

export interface BranchSubBranchSelectProps {
  branches: Branch[];
  mainBranchId: string;
  subBranchId: string;
  onMainBranchChange: (mainId: string) => void;
  onSubBranchChange: (subId: string) => void;
  /** Show empty option on main branch dropdown (for list filters) */
  allowAllMain?: boolean;
  allMainLabel?: string;
  /** Label for main-only row in sub dropdown */
  mainOnlySubLabel?: string;
  mainClassName?: string;
  subClassName?: string;
  className?: string;
  disabled?: boolean;
  mainPlaceholder?: string;
}

export function BranchSubBranchSelect({
  branches,
  mainBranchId,
  subBranchId,
  onMainBranchChange,
  onSubBranchChange,
  allowAllMain = false,
  allMainLabel = "All branches",
  mainOnlySubLabel = "Main branch",
  mainClassName,
  subClassName,
  className,
  disabled = false,
  mainPlaceholder = "Select branch",
}: BranchSubBranchSelectProps) {
  const mains = mainBranches(branches);
  const subs = mainBranchId ? subBranchesOf(branches, mainBranchId) : [];

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select
        value={mainBranchId}
        disabled={disabled}
        onChange={(e) => {
          onMainBranchChange(e.target.value);
          onSubBranchChange("");
        }}
        className={cn("w-44", mainClassName)}
        placeholder={allowAllMain ? undefined : mainPlaceholder}
        options={[
          ...(allowAllMain ? [{ value: "", label: allMainLabel }] : []),
          ...mains.map((b) => ({ value: b._id, label: b.name })),
        ]}
      />
      <Select
        value={subBranchId}
        disabled={disabled || !mainBranchId}
        onChange={(e) => onSubBranchChange(e.target.value)}
        className={cn("w-44", subClassName)}
        options={[
          {
            value: "",
            label: subs.length ? mainOnlySubLabel : "No sub-branches",
          },
          ...subs.map((b) => ({ value: b._id, label: b.name })),
        ]}
      />
    </div>
  );
}

/** Convenience handler helpers for controlled branch + sub-branch state */
export function createBranchFilterHandlers(
  setMain: (id: string) => void,
  setSub: (id: string) => void,
  getMain: () => string
) {
  return {
    onMainBranchChange: (id: string) => {
      setMain(id);
      setSub("");
    },
    onSubBranchChange: (id: string) => {
      setSub(id);
    },
    effectiveBranchId: (subId: string) => effectiveBranchId(getMain(), subId),
  };
}

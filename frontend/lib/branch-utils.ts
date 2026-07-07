import type { Branch } from "@/types/branch";

/** Main branches have no parent */
export function isMainBranch(branch: Pick<Branch, "parentBranchId">): boolean {
  return !branch.parentBranchId;
}

export function getParentBranchId(branch: Pick<Branch, "parentBranchId">): string | null {
  if (!branch.parentBranchId) return null;
  return typeof branch.parentBranchId === "object"
    ? branch.parentBranchId._id
    : branch.parentBranchId;
}

/** Effective branch for API calls — sub-branch wins when selected */
export function effectiveBranchId(mainId: string, subId: string): string {
  return subId || mainId;
}

export function resolveMainAndSubBranchId(
  branchId: string | undefined,
  branches: Branch[]
): { mainId: string; subId: string } {
  if (!branchId) return { mainId: "", subId: "" };
  const branch = branches.find((b) => b._id === branchId);
  if (!branch) return { mainId: branchId, subId: "" };
  const parentId = getParentBranchId(branch);
  if (parentId) return { mainId: parentId, subId: branchId };
  return { mainId: branchId, subId: "" };
}

export function formatBranchLabel(
  branch: Branch,
  allBranches?: Branch[]
): string {
  if (!branch.parentBranchId || !allBranches?.length) {
    return branch.name;
  }
  const parent =
    typeof branch.parentBranchId === "object"
      ? branch.parentBranchId
      : allBranches.find((b) => b._id === branch.parentBranchId);
  const parentName =
    parent && typeof parent === "object" && "name" in parent ? parent.name : null;
  return parentName ? `${parentName} → ${branch.name}` : branch.name;
}

export function mainBranches(branches: Branch[]): Branch[] {
  return branches.filter((b) => !b.parentBranchId);
}

export function subBranchesOf(branches: Branch[], parentId: string): Branch[] {
  return branches.filter((b) => {
    const pid =
      typeof b.parentBranchId === "string"
        ? b.parentBranchId
        : b.parentBranchId?._id;
    return pid === parentId;
  });
}

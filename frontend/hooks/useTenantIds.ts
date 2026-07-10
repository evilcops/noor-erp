import { useAuth, useBranch } from "@/hooks";

/** Active company + branch for create forms and dispatch APIs. */
export function useTenantIds() {
  const { user } = useAuth();
  const { branches, activeMainBranchId, activeBranchId } = useBranch();

  const mainBranch =
    branches.find((b) => b._id === activeMainBranchId) ?? branches.find((b) => !b.parentBranchId) ?? branches[0];

  const companyId = user?.companyId ?? mainBranch?.companyId ?? "";
  const branchId =
    activeBranchId ?? activeMainBranchId ?? user?.branchId ?? mainBranch?._id ?? "";

  return { companyId, branchId, mainBranch };
}

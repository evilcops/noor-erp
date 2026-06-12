import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { branchApi } from "@/lib/api/branches";
import type { PaginatedParams } from "@/types/api";
import type { CreateBranchInput, UpdateBranchInput } from "@/types/branch";

export function useBranches(params: PaginatedParams & { companyId?: string } = {}) {
  return useQuery({
    queryKey: ["branches", params],
    queryFn: () => branchApi.getAll(params),
  });
}

export function useBranchMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (data: CreateBranchInput) => branchApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success("Branch created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBranchInput }) =>
      branchApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success("Branch updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => branchApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success("Branch archived");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, remove };
}

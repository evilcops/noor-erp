import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { userApi, type CreateUserInput, type UpdateUserInput } from "@/lib/api/users";
import type { PaginatedParams } from "@/types/api";

export function useUsers(params: PaginatedParams & { role?: string } = {}) {
  return useQuery({
    queryKey: ["users", params],
    queryFn: () => userApi.getAll(params),
  });
}

export function useRoleDefinitions() {
  return useQuery({
    queryKey: ["role-definitions"],
    queryFn: () => userApi.getRoleDefinitions(),
  });
}

export function useUserMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (data: CreateUserInput) => userApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) =>
      userApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => userApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, remove };
}

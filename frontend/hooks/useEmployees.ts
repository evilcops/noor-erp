import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { employeeApi } from "@/lib/api/employees";
import type { PaginatedParams } from "@/types/api";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "@/types/employee";

export function useEmployees(params: PaginatedParams) {
  return useQuery({
    queryKey: ["employees", params],
    queryFn: () => employeeApi.getAll(params),
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: ["employee", id],
    queryFn: () => employeeApi.getById(id!),
    enabled: !!id,
  });
}

export function useEmployeeMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (data: CreateEmployeeInput) => employeeApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEmployeeInput }) =>
      employeeApi.update(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employee", id] });
      toast.success("Employee updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => employeeApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee archived");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadDoc = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      employeeApi.uploadDocument(id, formData),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["employee", id] });
      toast.success("Document uploaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDoc = useMutation({
    mutationFn: ({ id, docId }: { id: string; docId: string }) =>
      employeeApi.deleteDocument(id, docId),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["employee", id] });
      toast.success("Document removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { create, update, remove, uploadDoc, deleteDoc };
}

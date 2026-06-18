import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { PaginatedParams } from "@/types/api";
import type {
  CreateEmployeeInput,
  Employee,
  ExpiringDocumentAlert,
  UpdateEmployeeInput,
} from "@/types/employee";

export const employeeApi = {
  getAll: (params: PaginatedParams = {}) =>
    apiRequestWithMeta<Employee[]>(`/employees${buildQuery(params as Record<string, string | number | undefined>)}`),

  getById: (id: string) => apiRequest<Employee>(`/employees/${id}`),

  create: (data: CreateEmployeeInput) =>
    apiRequest<Employee>("/employees", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: UpdateEmployeeInput) =>
    apiRequest<Employee>(`/employees/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiRequest<{ message: string }>(`/employees/${id}`, { method: "DELETE" }),

  uploadDocument: (id: string, formData: FormData) =>
    apiRequest<Employee>(`/employees/${id}/documents`, { method: "POST", body: formData }),

  deleteDocument: (id: string, docId: string) =>
    apiRequest<{ message: string }>(`/employees/${id}/documents/${docId}`, { method: "DELETE" }),

  uploadFamilyBataka: (id: string, memberId: string, formData: FormData) => {
    // memberId goes in the body (flat route — avoids nested dynamic segments)
    formData.set("memberId", memberId);
    return apiRequest<Employee>(`/employees/${id}/family-bataka`, { method: "POST", body: formData });
  },

  getExpiringDocuments: (days = 274) =>
    apiRequest<ExpiringDocumentAlert[]>(`/employees/documents/expiring${buildQuery({ days })}`),
};

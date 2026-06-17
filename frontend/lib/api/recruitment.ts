import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { PaginatedParams } from "@/types/api";
import type { Candidate, CandidateStatus } from "@/types/recruitment";

export const recruitmentApi = {
  getCandidates: (params: PaginatedParams & { status?: string } = {}) =>
    apiRequestWithMeta<Candidate[]>(`/recruitment/candidates${buildQuery(params as Record<string, string | number | undefined>)}`),

  getById: (id: string) => apiRequest<Candidate>(`/recruitment/candidates/${id}`),

  create: (data: Partial<Candidate>) =>
    apiRequest<Candidate>("/recruitment/candidates", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Candidate>) =>
    apiRequest<Candidate>(`/recruitment/candidates/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  updateStatus: (id: string, status: CandidateStatus, extra?: Record<string, unknown>) =>
    apiRequest<Candidate>(`/recruitment/candidates/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, ...extra }),
    }),

  scheduleInterview: (id: string, data: Record<string, unknown>) =>
    apiRequest<Candidate>(`/recruitment/candidates/${id}/schedule-interview`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  interviewFeedback: (id: string, data: { feedback: string; rating: number }) =>
    apiRequest<Candidate>(`/recruitment/candidates/${id}/interview-feedback`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  convertToEmployee: (id: string) =>
    apiRequest<{ candidate: Candidate; employee: unknown }>(
      `/recruitment/candidates/${id}/convert-to-employee`,
      { method: "POST" }
    ),

  uploadCV: (id: string, formData: FormData) =>
    apiRequest<Candidate>(`/recruitment/candidates/${id}/cv`, {
      method: "POST",
      body: formData,
    }),
};

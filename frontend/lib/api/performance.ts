import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";

export interface PerformanceGoal {
  _id?: string;
  description: string;
  deadline?: string;
  status: "pending" | "in_progress" | "completed";
}

export interface PerformanceReview {
  _id: string;
  employeeId: { _id: string; firstName: string; lastName: string; department?: string; designation?: string };
  reviewerId: string;
  reviewCycle: string;
  rating?: number;
  strengths: string[];
  improvements: string[];
  goals: PerformanceGoal[];
  managerComments?: string;
  employeeComments?: string;
  status: "draft" | "pending_manager" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
}

export const performanceApi = {
  list: (params: { status?: string; employeeId?: string; page?: number; limit?: number } = {}) =>
    apiRequestWithMeta<PerformanceReview[]>(`/performance/reviews${buildQuery(params)}`),

  getMyReviews: () => apiRequest<PerformanceReview[]>("/performance/my-reviews"),

  getById: (id: string) => apiRequest<PerformanceReview>(`/performance/reviews/${id}`),

  create: (data: { employeeId: string; reviewCycle: string; dueDate?: string }) =>
    apiRequest<PerformanceReview>("/performance/reviews", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<PerformanceReview>) =>
    apiRequest<PerformanceReview>(`/performance/reviews/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  submit: (id: string) =>
    apiRequest<PerformanceReview>(`/performance/reviews/${id}/submit`, { method: "PUT" }),

  complete: (id: string, data: { managerComments?: string; rating?: number }) =>
    apiRequest<PerformanceReview>(`/performance/reviews/${id}/complete`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

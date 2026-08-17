import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";

export type AdLanguage = "en" | "ur" | "ar";

export type ProductAdStatus =
  | "pending"
  | "generating"
  | "ready"
  | "revision_requested"
  | "approved"
  | "broadcasting"
  | "broadcasted"
  | "failed";

export interface ProductAd {
  _id: string;
  companyId: string;
  productId: string | { _id: string; name: string; sku?: string; images?: string[] };
  language: AdLanguage;
  prompt: string;
  durationSeconds: number;
  status: ProductAdStatus;
  openArtHistoryId?: string;
  openArtResourceIds?: string[];
  videoUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
  revisionFeedback?: string;
  parentAdId?: string | null;
  approvedAt?: string;
  broadcastAt?: string;
  broadcastResults?: Array<{
    customerId: string;
    channel: "email" | "whatsapp";
    status: "sent" | "skipped" | "failed";
    detail?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductAdInput {
  productId: string;
  companyId?: string;
  language: AdLanguage;
  durationSeconds?: number;
  waitForCompletion?: boolean;
  autoBroadcast?: boolean;
  revisionFeedback?: string;
  parentAdId?: string;
}

export const marketingApi = {
  listAds: (params: { productId?: string; page?: number; limit?: number; companyId?: string } = {}) =>
    apiRequestWithMeta<ProductAd[]>(
      `/marketing/ads${buildQuery(params as Record<string, string | number | undefined>)}`
    ),

  getAd: (id: string) => apiRequest<ProductAd>(`/marketing/ads/${id}`),

  createAd: (data: CreateProductAdInput) =>
    apiRequest<ProductAd>("/marketing/ads", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  approveAd: (id: string, data: { broadcast?: boolean } = {}) =>
    apiRequest<ProductAd>(`/marketing/ads/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  reviseAd: (id: string, feedback: string) =>
    apiRequest<ProductAd>(`/marketing/ads/${id}/revise`, {
      method: "POST",
      body: JSON.stringify({ feedback }),
    }),

  broadcastAd: (id: string) =>
    apiRequest<ProductAd>(`/marketing/ads/${id}/broadcast`, { method: "POST" }),

  openArtStatus: () =>
    apiRequest<{
      ok: boolean;
      mode: "mock" | "live";
      message: string;
      projectId?: string;
      user?: { id?: string; displayName?: string; username?: string; credits?: number };
    }>("/marketing/openart/status"),
};

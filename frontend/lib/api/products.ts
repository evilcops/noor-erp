import { apiRequest, apiRequestWithMeta, buildQuery } from "@/lib/api/client";
import type { PaginatedParams } from "@/types/api";
import type { CreateProductInput, Product, UpdateProductInput } from "@/types/inventory";

export const productApi = {
  list: (params: PaginatedParams & { status?: string; category?: string; supplierId?: string } = {}) =>
    apiRequestWithMeta<Product[]>(`/products${buildQuery(params as Record<string, string | number | undefined>)}`),

  get: (id: string) => apiRequest<Product & { stockLevels?: unknown[] }>(`/products/${id}`),

  create: (data: CreateProductInput) =>
    apiRequest<Product>("/products", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: UpdateProductInput) =>
    apiRequest<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  remove: (id: string) =>
    apiRequest<{ message: string }>(`/products/${id}`, { method: "DELETE" }),

  lookup: (code: string) => apiRequest<Product>(`/products/lookup/${encodeURIComponent(code)}`),

  categories: () =>
    apiRequest<{ categories: string[]; subCategories: string[] }>("/products/categories"),

  uploadImage: (id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<Product>(`/products/${id}/images`, { method: "POST", body: formData });
  },

  removeImage: (id: string, imageIndex: number) =>
    apiRequest<Product>(`/products/${id}/images/${imageIndex}`, { method: "DELETE" }),
};

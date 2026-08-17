import { apiRequest, apiRequestWithMeta, buildQuery } from "./client";

export interface StoreProduct {
  _id: string;
  name: string;
  sku: string;
  code?: string;
  category?: string;
  subCategory?: string;
  brand?: string;
  description?: string;
  specifications?: string;
  sellingPrice?: number;
  unitOfMeasure: string;
  images: string[];
  status: string;
  availableStock: number;
}

export interface StoreCustomer {
  _id: string;
  name?: string;
  phone: string;
  email?: string;
  address?: string;
  area?: string;
}

export interface StoreAuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string;
  role: string;
  companyId?: string;
  branchId?: string;
  isActive: boolean;
}

export interface StoreAuthResult {
  user: StoreAuthUser;
  customer: StoreCustomer;
  accessToken: string;
  refreshToken: string;
}

export interface StoreOrder {
  _id: string;
  saleNumber: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
  items?: {
    productId: string | { _id: string; name: string; sku: string; images?: string[] };
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  productId?: string | { name: string; sku: string; images?: string[] };
  riderAssigned?: boolean;
  riderCode?: string;
  delivery?: {
    deliveryNumber?: string;
    status?: string;
    promisedWindowStart?: string;
    promisedWindowEnd?: string;
  };
}

export const storeApi = {
  products: (params?: { page?: number; limit?: number; search?: string; category?: string }) =>
    apiRequestWithMeta<{ products: StoreProduct[]; categories: string[] }>(
      `/store/products${buildQuery(params as Record<string, string | number | undefined>)}`
    ),

  product: (id: string) => apiRequest<StoreProduct>(`/store/products/${id}`),

  register: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    address?: string;
    area?: string;
  }) => apiRequest<StoreAuthResult>("/store/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    apiRequest<StoreAuthResult>("/store/auth/login", { method: "POST", body: JSON.stringify(data) }),

  logout: () => apiRequest<{ message: string }>("/store/auth/logout", { method: "POST" }),

  me: () =>
    apiRequest<{ user: StoreAuthUser; customer: StoreCustomer }>("/store/auth/me"),

  checkout: (data: {
    items: { productId: string; quantity: number }[];
    name?: string;
    address?: string;
    area?: string;
    notes?: string;
  }) => apiRequest<StoreOrder>("/store/checkout", { method: "POST", body: JSON.stringify(data) }),

  orders: (params?: { page?: number; limit?: number }) =>
    apiRequestWithMeta<StoreOrder[]>(
      `/store/orders${buildQuery(params as Record<string, string | number | undefined>)}`
    ),
};

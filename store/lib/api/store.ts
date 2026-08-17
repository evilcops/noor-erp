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
  branchId?: string;
}

export interface StoreBranch {
  _id: string;
  name: string;
  code: string;
  address?: string;
  deliveryRadiusKm: number;
  distanceKm?: number;
  gpsCoordinates?: { lat: number; lng: number };
}

export interface StoreCustomer {
  _id: string;
  name?: string;
  phone: string;
  email?: string;
  address?: string;
  area?: string;
  coordinates?: { lat: number; lng: number };
  branchId?: string;
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
  branch?: StoreBranch | null;
  accessToken: string;
  refreshToken: string;
}

export interface StoreLocationResult {
  coordinates: { lat: number; lng: number };
  address?: string;
  inService: boolean;
  distanceKm?: number;
  clusterId?: string | null;
  branch: StoreBranch;
  message: string;
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
  riderName?: string;
  delivery?: {
    _id?: string;
    deliveryNumber?: string;
    status?: string;
    warehouseStatus?: string;
    promisedWindowStart?: string;
    promisedWindowEnd?: string;
    estimatedArrival?: string;
    travelTimeMinutes?: number;
  } | null;
}

export interface StoreOrderTrack {
  order: {
    _id: string;
    saleNumber: string;
    totalAmount: number;
    quantity: number;
    createdAt: string;
    items?: StoreOrder["items"];
    branch?: string | { name?: string; address?: string; gpsCoordinates?: { lat: number; lng: number } };
  };
  delivery: {
    _id: string;
    deliveryNumber: string;
    status: string;
    warehouseStatus?: string;
    deliveryAddress?: string;
    area?: string;
    coordinates?: { lat: number; lng: number };
    promisedWindowStart?: string;
    promisedWindowEnd?: string;
    estimatedArrival?: string;
    travelTimeMinutes?: number;
    actualDeliveryAt?: string;
  };
  rider: {
    riderCode?: string;
    name?: string;
    phone?: string;
    status?: string;
    location?: { lat: number; lng: number; updatedAt?: string } | null;
  } | null;
  eta: {
    estimatedArrival?: string | null;
    minutesRemaining?: number | null;
    travelTimeMinutes?: number | null;
  };
}

export const storeApi = {
  branches: () => apiRequest<StoreBranch[]>("/store/branches"),

  resolveLocation: (data: {
    address?: string;
    branchId?: string;
    lat?: number;
    lng?: number;
    coordinates?: { lat: number; lng: number };
  }) => apiRequest<StoreLocationResult>("/store/location", { method: "POST", body: JSON.stringify(data) }),

  updateLocation: (data: {
    address?: string;
    area?: string;
    branchId?: string;
    lat?: number;
    lng?: number;
    coordinates?: { lat: number; lng: number };
  }) => apiRequest<{ customer: StoreCustomer; branch: StoreBranch | null; inService: boolean }>(
    "/store/location",
    { method: "PATCH", body: JSON.stringify(data) }
  ),

  products: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    branchId?: string;
  }) =>
    apiRequestWithMeta<{
      products: StoreProduct[];
      categories: string[];
      branch: StoreBranch | null;
      browseMode?: boolean;
    }>(`/store/products${buildQuery(params as Record<string, string | number | undefined>)}`),

  product: (id: string, branchId?: string) =>
    apiRequest<StoreProduct>(
      `/store/products/${id}${branchId ? buildQuery({ branchId }) : ""}`
    ),

  register: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    address?: string;
    area?: string;
    branchId?: string;
    coordinates?: { lat: number; lng: number };
  }) => apiRequest<StoreAuthResult>("/store/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    apiRequest<StoreAuthResult>("/store/auth/login", { method: "POST", body: JSON.stringify(data) }),

  logout: () => apiRequest<{ message: string }>("/store/auth/logout", { method: "POST" }),

  me: () =>
    apiRequest<{ user: StoreAuthUser; customer: StoreCustomer; branch?: StoreBranch | null }>(
      "/store/auth/me"
    ),

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

  trackOrder: (id: string) => apiRequest<StoreOrderTrack>(`/store/orders/${id}/track`),
};

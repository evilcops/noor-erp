import type { PurchaseOrder } from "@/types/purchase";

export type SupplierStatus = "active" | "inactive" | "blacklisted" | "archived";

export interface Supplier {
  _id: string;
  companyId: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  country?: string;
  productIds?: Array<string | { _id: string; name: string; sku: string }>;
  paymentTerms?: string;
  deliveryLeadTimeDays?: number;
  notes?: string;
  rating?: number;
  status: SupplierStatus;
  totalOrders?: number;
  totalSpent?: number;
  lastOrderAt?: string | null;
  purchaseOrders?: PurchaseOrder[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDetail extends Supplier {
  purchaseOrders: PurchaseOrder[];
}

export interface CreateSupplierInput {
  companyId?: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  country?: string;
  productIds?: string[];
  paymentTerms?: string;
  deliveryLeadTimeDays?: number;
  notes?: string;
  rating?: number;
  status?: SupplierStatus;
}

export type UpdateSupplierInput = Partial<Omit<CreateSupplierInput, "companyId">>;

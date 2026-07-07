import type { Delivery } from "@/types/delivery";

export interface Customer {
  _id: string;
  companyId: string;
  name?: string;
  phone: string;
  email?: string;
  address?: string;
  area?: string;
  notes?: string;
  totalPurchases?: number;
  totalSpent?: number;
  lastPurchaseAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  _id: string;
  companyId: string;
  branchId: string | { _id: string; name: string; code?: string };
  customerId: string | { _id: string; name?: string; phone: string; email?: string };
  productId: string | { _id: string; name: string; sku: string; code?: string; unitOfMeasure?: string; images?: string[] };
  saleNumber: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  soldBy?: { firstName: string; lastName: string };
  notes?: string;
  createdAt: string;
  customerCreated?: boolean;
  riderAssigned?: boolean;
  riderCode?: string;
  delivery?: Delivery;
}

export interface CustomerDetail extends Customer {
  sales: Sale[];
}

export interface RecordSaleInput {
  companyId: string;
  branchId: string;
  productId: string;
  quantity: number;
  customerId?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  customerAddress?: string;
  customerArea?: string;
  unitPrice?: number;
  notes?: string;
  promisedWindowStart?: string;
  promisedWindowEnd?: string;
}

export interface CreateCustomerInput {
  companyId: string;
  phone: string;
  email?: string;
  name?: string;
  address?: string;
  area?: string;
  notes?: string;
}

export interface Customer {
  _id: string;
  companyId: string;
  name?: string;
  phone: string;
  email?: string;
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
  unitPrice?: number;
  notes?: string;
}

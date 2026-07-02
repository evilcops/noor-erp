import type { PurchaseOrder } from "@/types/purchase";

export type ProductStatus = "active" | "inactive" | "discontinued" | "out_of_stock" | "archived";

export interface Product {
  _id: string;
  companyId: string;
  name: string;
  code: string;
  sku: string;
  barcode?: string;
  qrCodeData?: string;
  category?: string;
  subCategory?: string;
  brand?: string;
  supplierId?: string | { _id: string; name: string };
  description?: string;
  specifications?: string;
  purchaseCost?: number;
  sellingPrice?: number;
  unitOfMeasure: string;
  minStockLevel: number;
  reorderLevel: number;
  images: string[];
  status: ProductStatus;
  notes?: string;
  stockLevels?: StockLevel[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  companyId: string;
  name: string;
  code?: string;
  sku?: string;
  barcode?: string;
  category?: string;
  subCategory?: string;
  brand?: string;
  supplierId?: string;
  description?: string;
  specifications?: string;
  purchaseCost?: number;
  sellingPrice?: number;
  unitOfMeasure?: string;
  minStockLevel?: number;
  reorderLevel?: number;
  status?: ProductStatus;
  notes?: string;
  initialStock?: { branchId: string; quantity: number };
}

export type UpdateProductInput = Partial<Omit<CreateProductInput, "companyId">>;

export interface StockLevel {
  _id: string;
  companyId: string;
  branchId: string | { _id: string; name: string; code?: string };
  productId: string | { _id: string; name: string; sku: string; code?: string };
  openingStock: number;
  currentStock: number;
  damagedStock: number;
  returnedStock: number;
  minStockLevel?: number;
  reorderLevel?: number;
  effectiveReorderLevel?: number;
  suggestedRestockQty?: number;
  needsRestock?: boolean;
}

export type StockMovementType =
  | "purchase_received"
  | "transfer_in"
  | "transfer_out"
  | "adjustment"
  | "damaged"
  | "returned"
  | "manual_correction"
  | "sale";

export interface StockMovement {
  _id: string;
  branchId: string | { _id: string; name: string };
  productId: string | { _id: string; name: string; sku: string };
  type: StockMovementType;
  quantity: number;
  previousQty: number;
  newQty: number;
  reason?: string;
  notes?: string;
  createdBy?: { firstName: string; lastName: string };
  createdAt: string;
}

export interface InventoryDashboard {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  pendingPurchaseOrders: number;
  stockInTransit: number;
  pendingTransfers: number;
  activeSuppliers: number;
  lowStock: StockLevel[];
  outOfStock: StockLevel[];
  branchSummary: {
    branchId: string;
    branchName: string;
    totalItems: number;
    totalQty: number;
    lowStockCount: number;
  }[];
  purchaseByStatus?: Record<string, number>;
  recentPurchaseOrders?: PurchaseOrder[];
}

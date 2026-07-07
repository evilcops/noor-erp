export type PurchaseStatus =
  | "draft"
  | "requested"
  | "approved"
  | "ordered"
  | "in_transit"
  | "partially_received"
  | "received"
  | "cancelled"
  | "closed";

export interface PurchaseOrderItem {
  productId:
    | string
    | {
        _id: string;
        name: string;
        sku: string;
        unitOfMeasure?: string;
        purchaseCost?: number;
        sellingPrice?: number;
      };
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  previousPurchaseCost?: number;
  previousSellingPrice?: number;
  newPurchaseCost?: number;
  newSellingPrice?: number;
  notes?: string;
}

export interface AmendPurchaseItemInput {
  productId: string;
  quantityOrdered?: number;
  newPurchaseCost?: number;
  newSellingPrice?: number;
}

export interface PurchaseOrder {
  _id: string;
  companyId: string;
  branchId: string | { _id: string; name: string; code?: string };
  supplierId: string | { _id: string; name: string; contactPerson?: string; phone?: string; email?: string };
  poNumber: string;
  status: PurchaseStatus;
  items: PurchaseOrderItem[];
  totalAmount: number;
  expectedDeliveryDate?: string;
  orderedAt?: string;
  receivedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseInput {
  companyId: string;
  branchId: string;
  supplierId: string;
  items: { productId: string; quantityOrdered: number; unitCost: number; notes?: string }[];
  expectedDeliveryDate?: string;
  notes?: string;
}

export type StockTransferStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "dispatched"
  | "received"
  | "cancelled";

export interface StockTransferItem {
  productId: string | { _id: string; name: string; sku: string; unitOfMeasure?: string };
  quantityRequested: number;
  quantityDispatched: number;
  quantityReceived: number;
  notes?: string;
}

export interface StockTransfer {
  _id: string;
  companyId: string;
  transferNumber: string;
  fromBranchId: string | { _id: string; name: string; code?: string };
  toBranchId: string | { _id: string; name: string; code?: string };
  status: StockTransferStatus;
  items: StockTransferItem[];
  notes?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStockTransferInput {
  companyId: string;
  fromBranchId: string;
  toBranchId: string;
  items: { productId: string; quantityRequested: number; notes?: string }[];
  notes?: string;
}

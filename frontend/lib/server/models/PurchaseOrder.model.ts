import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

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

export interface IPurchaseOrderItem {
  productId: mongoose.Types.ObjectId;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  previousPurchaseCost?: number;
  previousSellingPrice?: number;
  newPurchaseCost?: number;
  newSellingPrice?: number;
  notes?: string;
}

export interface IPurchaseOrder extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  poNumber: string;
  status: PurchaseStatus;
  items: IPurchaseOrderItem[];
  requestedBy?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  orderedAt?: Date;
  expectedDeliveryDate?: Date;
  receivedAt?: Date;
  invoiceUrl?: string;
  notes?: string;
  totalAmount: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    poNumber: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "draft",
        "requested",
        "approved",
        "ordered",
        "in_transit",
        "partially_received",
        "received",
        "cancelled",
        "closed",
      ],
      default: "draft",
    },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        quantityOrdered: { type: Number, required: true, min: 1 },
        quantityReceived: { type: Number, default: 0 },
        unitCost: { type: Number, required: true, min: 0 },
        previousPurchaseCost: Number,
        previousSellingPrice: Number,
        newPurchaseCost: Number,
        newSellingPrice: Number,
        notes: String,
      },
    ],
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    orderedAt: Date,
    expectedDeliveryDate: Date,
    receivedAt: Date,
    invoiceUrl: String,
    notes: String,
    totalAmount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ companyId: 1, poNumber: 1 }, { unique: true });
purchaseOrderSchema.plugin(softDeletePlugin);

export const PurchaseOrder: Model<IPurchaseOrder> =
  mongoose.models.PurchaseOrder ??
  mongoose.model<IPurchaseOrder>("PurchaseOrder", purchaseOrderSchema);

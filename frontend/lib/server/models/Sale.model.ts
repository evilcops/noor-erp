import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ISaleItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ISale extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  /** Primary / first product — kept for legacy readers and standing orders. */
  productId: mongoose.Types.ObjectId;
  saleNumber: string;
  /** Total units across all line items. */
  quantity: number;
  /** Unit price of the first line item (legacy). */
  unitPrice: number;
  totalAmount: number;
  items: ISaleItem[];
  soldBy?: mongoose.Types.ObjectId;
  notes?: string;
  /** Where the sale originated: POS/inventory counter vs customer store app. */
  source: "pos" | "store";
  status: "open" | "completed" | "cancelled";
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelReason?: string;
  createdAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new Schema<ISale>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    saleNumber: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    items: { type: [saleItemSchema], default: [] },
    soldBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: String,
    source: {
      type: String,
      enum: ["pos", "store"],
      default: "pos",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "completed", "cancelled"],
      default: "open",
      index: true,
    },
    cancelledAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelReason: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

saleSchema.index({ companyId: 1, saleNumber: 1 }, { unique: true });

/** Re-register so hot reload picks up new paths like `items` (same pattern as Delivery/Rider). */
if (mongoose.models.Sale) {
  mongoose.deleteModel("Sale");
}

export const Sale: Model<ISale> = mongoose.model<ISale>("Sale", saleSchema);

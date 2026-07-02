import mongoose, { Schema, type Document, type Model } from "mongoose";

export type StockMovementType =
  | "purchase_received"
  | "transfer_in"
  | "transfer_out"
  | "adjustment"
  | "damaged"
  | "returned"
  | "manual_correction"
  | "sale";

export interface IStockMovement extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  previousQty: number;
  newQty: number;
  reason?: string;
  notes?: string;
  referenceType?: string;
  referenceId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    type: {
      type: String,
      enum: [
        "purchase_received",
        "transfer_in",
        "transfer_out",
        "adjustment",
        "damaged",
        "returned",
        "manual_correction",
        "sale",
      ],
      required: true,
    },
    quantity: { type: Number, required: true },
    previousQty: { type: Number, required: true },
    newQty: { type: Number, required: true },
    reason: String,
    notes: String,
    referenceType: String,
    referenceId: Schema.Types.ObjectId,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ companyId: 1, createdAt: -1 });

// Re-register when schema changes (Next.js dev HMR keeps a stale cached model).
if (mongoose.models.StockMovement) {
  mongoose.deleteModel("StockMovement");
}

export const StockMovement: Model<IStockMovement> =
  mongoose.model<IStockMovement>("StockMovement", stockMovementSchema);

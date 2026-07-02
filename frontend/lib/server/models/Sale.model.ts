import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ISale extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  saleNumber: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  soldBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
}

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
    soldBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

saleSchema.index({ companyId: 1, saleNumber: 1 }, { unique: true });

export const Sale: Model<ISale> =
  mongoose.models.Sale ?? mongoose.model<ISale>("Sale", saleSchema);

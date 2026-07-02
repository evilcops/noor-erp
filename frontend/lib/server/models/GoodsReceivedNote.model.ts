import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IGrnItem {
  productId: mongoose.Types.ObjectId;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

export interface IGoodsReceivedNote extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  purchaseOrderId: mongoose.Types.ObjectId;
  grnNumber: string;
  items: IGrnItem[];
  receivedBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
}

const grnSchema = new Schema<IGoodsReceivedNote>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: "PurchaseOrder", required: true, index: true },
    grnNumber: { type: String, required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        quantityOrdered: Number,
        quantityReceived: { type: Number, required: true, min: 0 },
        unitCost: Number,
      },
    ],
    receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

grnSchema.index({ companyId: 1, grnNumber: 1 }, { unique: true });

export const GoodsReceivedNote: Model<IGoodsReceivedNote> =
  mongoose.models.GoodsReceivedNote ??
  mongoose.model<IGoodsReceivedNote>("GoodsReceivedNote", grnSchema);

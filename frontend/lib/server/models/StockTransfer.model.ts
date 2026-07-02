import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export type StockTransferStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "dispatched"
  | "received"
  | "cancelled";

export interface IStockTransferItem {
  productId: mongoose.Types.ObjectId;
  quantityRequested: number;
  quantityDispatched: number;
  quantityReceived: number;
  notes?: string;
}

export interface IStockTransfer extends Document {
  companyId: mongoose.Types.ObjectId;
  transferNumber: string;
  fromBranchId: mongoose.Types.ObjectId;
  toBranchId: mongoose.Types.ObjectId;
  status: StockTransferStatus;
  items: IStockTransferItem[];
  requestedBy?: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  dispatchedAt?: Date;
  receivedAt?: Date;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const stockTransferSchema = new Schema<IStockTransfer>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    transferNumber: { type: String, required: true },
    fromBranchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    toBranchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    status: {
      type: String,
      enum: ["requested", "approved", "rejected", "dispatched", "received", "cancelled"],
      default: "requested",
    },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
        quantityRequested: { type: Number, required: true, min: 1 },
        quantityDispatched: { type: Number, default: 0 },
        quantityReceived: { type: Number, default: 0 },
        notes: String,
      },
    ],
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    dispatchedAt: Date,
    receivedAt: Date,
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

stockTransferSchema.index({ companyId: 1, transferNumber: 1 }, { unique: true });
stockTransferSchema.plugin(softDeletePlugin);

export const StockTransfer: Model<IStockTransfer> =
  mongoose.models.StockTransfer ??
  mongoose.model<IStockTransfer>("StockTransfer", stockTransferSchema);

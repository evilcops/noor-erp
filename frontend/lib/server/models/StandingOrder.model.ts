import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export type StandingOrderFrequency =
  | "standing_daily"
  | "standing_weekly"
  | "standing_fortnightly";

export interface IStandingOrder extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  frequency: StandingOrderFrequency;
  clusterId?: mongoose.Types.ObjectId;
  nextDueAt: Date;
  unitPrice?: number;
  notes?: string;
  status: "active" | "paused" | "cancelled";
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const standingOrderSchema = new Schema<IStandingOrder>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    frequency: {
      type: String,
      enum: ["standing_daily", "standing_weekly", "standing_fortnightly"],
      required: true,
    },
    clusterId: { type: Schema.Types.ObjectId, ref: "DeliveryCluster" },
    nextDueAt: { type: Date, required: true, index: true },
    unitPrice: Number,
    notes: String,
    status: { type: String, enum: ["active", "paused", "cancelled"], default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

standingOrderSchema.index({ branchId: 1, nextDueAt: 1, status: 1 });
standingOrderSchema.plugin(softDeletePlugin);

export const StandingOrder: Model<IStandingOrder> =
  mongoose.models.StandingOrder ??
  mongoose.model<IStandingOrder>("StandingOrder", standingOrderSchema);

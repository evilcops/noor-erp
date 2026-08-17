import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export type RefusedItemStatus = "with_rider" | "at_warehouse" | "restocked" | "discarded";

export interface IRefusedItem extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  deliveryId: mongoose.Types.ObjectId;
  saleId: mongoose.Types.ObjectId;
  riderId?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  status: RefusedItemStatus;
  refuseReason?: string;
  deliveryNumber?: string;
  saleNumber?: string;
  returnedAt?: Date;
  restockedAt?: Date;
  restockedBy?: mongoose.Types.ObjectId;
  discardedAt?: Date;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const refusedItemSchema = new Schema<IRefusedItem>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    deliveryId: { type: Schema.Types.ObjectId, ref: "Delivery", required: true, index: true },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true, index: true },
    riderId: { type: Schema.Types.ObjectId, ref: "Rider", index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["with_rider", "at_warehouse", "restocked", "discarded"],
      default: "with_rider",
      index: true,
    },
    refuseReason: String,
    deliveryNumber: String,
    saleNumber: String,
    returnedAt: Date,
    restockedAt: Date,
    restockedBy: { type: Schema.Types.ObjectId, ref: "User" },
    discardedAt: Date,
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

refusedItemSchema.index({ companyId: 1, status: 1, createdAt: -1 });
refusedItemSchema.plugin(softDeletePlugin);

if (mongoose.models.RefusedItem) {
  mongoose.deleteModel("RefusedItem");
}

export const RefusedItem: Model<IRefusedItem> = mongoose.model<IRefusedItem>(
  "RefusedItem",
  refusedItemSchema
);

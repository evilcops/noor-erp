import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IStockLevel extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  openingStock: number;
  currentStock: number;
  damagedStock: number;
  returnedStock: number;
  minStockLevel?: number;
  reorderLevel?: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const stockLevelSchema = new Schema<IStockLevel>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    openingStock: { type: Number, default: 0 },
    currentStock: { type: Number, default: 0 },
    damagedStock: { type: Number, default: 0 },
    returnedStock: { type: Number, default: 0 },
    minStockLevel: Number,
    reorderLevel: Number,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

stockLevelSchema.index({ companyId: 1, branchId: 1, productId: 1 }, { unique: true });

export const StockLevel: Model<IStockLevel> =
  mongoose.models.StockLevel ?? mongoose.model<IStockLevel>("StockLevel", stockLevelSchema);

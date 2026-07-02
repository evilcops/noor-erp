import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export type ProductStatus = "active" | "inactive" | "discontinued" | "out_of_stock" | "archived";

export interface IProduct extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  sku: string;
  barcode?: string;
  qrCodeData?: string;
  category?: string;
  subCategory?: string;
  brand?: string;
  supplierId?: mongoose.Types.ObjectId;
  description?: string;
  specifications?: string;
  purchaseCost?: number;
  sellingPrice?: number;
  unitOfMeasure: string;
  minStockLevel: number;
  reorderLevel: number;
  images: string[];
  status: ProductStatus;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const productSchema = new Schema<IProduct>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true },
    qrCodeData: String,
    category: String,
    subCategory: String,
    brand: String,
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier" },
    description: String,
    specifications: String,
    purchaseCost: Number,
    sellingPrice: Number,
    unitOfMeasure: { type: String, default: "pcs" },
    minStockLevel: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
    images: [String],
    status: {
      type: String,
      enum: ["active", "inactive", "discontinued", "out_of_stock", "archived"],
      default: "active",
    },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

productSchema.index({ companyId: 1, sku: 1 }, { unique: true });
productSchema.index({ companyId: 1, code: 1 });
productSchema.index({ companyId: 1, name: "text", sku: "text", code: "text" });

productSchema.plugin(softDeletePlugin);

export const Product: Model<IProduct> =
  mongoose.models.Product ?? mongoose.model<IProduct>("Product", productSchema);

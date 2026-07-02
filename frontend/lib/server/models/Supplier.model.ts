import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export type SupplierStatus = "active" | "inactive" | "blacklisted" | "archived";

export interface ISupplierDocument {
  type: string;
  url: string;
  name?: string;
}

export interface ISupplier extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  country?: string;
  productIds: mongoose.Types.ObjectId[];
  paymentTerms?: string;
  deliveryLeadTimeDays?: number;
  documents: ISupplierDocument[];
  notes?: string;
  rating?: number;
  status: SupplierStatus;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const supplierSchema = new Schema<ISupplier>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: { type: String, required: true, trim: true },
    contactPerson: String,
    phone: String,
    email: { type: String, lowercase: true, trim: true },
    address: String,
    country: { type: String, default: "OM" },
    productIds: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    paymentTerms: String,
    deliveryLeadTimeDays: Number,
    documents: [{ type: String, url: String, name: String }],
    notes: String,
    rating: { type: Number, min: 1, max: 5 },
    status: {
      type: String,
      enum: ["active", "inactive", "blacklisted", "archived"],
      default: "active",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

supplierSchema.index({ companyId: 1, name: 1 });
supplierSchema.plugin(softDeletePlugin);

export const Supplier: Model<ISupplier> =
  mongoose.models.Supplier ?? mongoose.model<ISupplier>("Supplier", supplierSchema);

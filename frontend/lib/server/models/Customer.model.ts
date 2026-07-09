import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export interface ICustomer extends Document {
  companyId: mongoose.Types.ObjectId;
  name?: string;
  phone: string;
  email?: string;
  address?: string;
  area?: string;
  coordinates?: { lat: number; lng: number };
  /** Delivery cluster covering this customer's location (null if outside all clusters) */
  clusterId?: mongoose.Types.ObjectId | null;
  /** Main branch whose cluster grid covers this customer */
  branchId?: mongoose.Types.ObjectId | null;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const customerSchema = new Schema<ICustomer>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    name: String,
    phone: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: String,
    area: String,
    coordinates: { lat: Number, lng: Number },
    clusterId: { type: Schema.Types.ObjectId, ref: "DeliveryCluster", default: null, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

customerSchema.index({ companyId: 1, phone: 1 });
customerSchema.plugin(softDeletePlugin);

export const Customer: Model<ICustomer> =
  mongoose.models.Customer ?? mongoose.model<ICustomer>("Customer", customerSchema);

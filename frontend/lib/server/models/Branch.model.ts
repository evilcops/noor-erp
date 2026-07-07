import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { DeliveryExpandedRegion } from "@/lib/compass-directions";
import { softDeletePlugin } from "./plugins/softDelete";

export interface IBranchHoliday {
  name: string;
  date: Date;
  isRecurring: boolean;
}

export interface IBranch extends Document {
  companyId: mongoose.Types.ObjectId;
  parentBranchId?: mongoose.Types.ObjectId | null;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  managerId?: mongoose.Types.ObjectId;
  gpsCoordinates?: { lat: number; lng: number };
  allowedRadius: number;
  /** Delivery service disk radius in km */
  deliveryRadiusKm: number;
  /** Pie slices around warehouse */
  deliveryClusterCount: number;
  /** Optional expanded arcs with custom radius and cluster density */
  deliveryExpandedRegions?: DeliveryExpandedRegion[];
  holidays: IBranchHoliday[];
  status: "active" | "inactive";
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const branchSchema = new Schema<IBranch>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    parentBranchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    address: String,
    phone: String,
    email: String,
    managerId: { type: Schema.Types.ObjectId, ref: "User" },
    gpsCoordinates: {
      lat: Number,
      lng: Number,
    },
    allowedRadius: { type: Number, default: 100 },
    deliveryRadiusKm: { type: Number, default: 10, min: 1, max: 100 },
    deliveryClusterCount: { type: Number, default: 5, min: 2, max: 24 },
    deliveryExpandedRegions: [
      {
        fromDirection: { type: String },
        toDirection: { type: String },
        radiusKm: { type: Number, min: 1, max: 100 },
        clusterCount: { type: Number, min: 1, max: 24 },
      },
    ],
    holidays: [
      {
        name: String,
        date: Date,
        isRecurring: { type: Boolean, default: false },
      },
    ],
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

branchSchema.index({ companyId: 1, code: 1 }, { unique: true });
branchSchema.index({ parentBranchId: 1, status: 1 });
branchSchema.plugin(softDeletePlugin);

if (mongoose.models.Branch) {
  mongoose.deleteModel("Branch");
}

export const Branch: Model<IBranch> =
  mongoose.models.Branch ?? mongoose.model<IBranch>("Branch", branchSchema);

import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export type ClusterShape = "circle" | "square" | "sector";

export interface IDeliveryCluster extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  center: { lat: number; lng: number };
  /** Warehouse origin for pie-sector zones */
  origin?: { lat: number; lng: number };
  shape: ClusterShape;
  /** Radius for circles/sectors; half-width for squares */
  radiusKm: number;
  cellSizeKm?: number;
  mainRadiusKm?: number;
  sectorStartDeg?: number;
  sectorEndDeg?: number;
  /** Total pie slices for this branch grid (e.g. 5 or 7) */
  sectorCount?: number;
  description?: string;
  status: "active" | "inactive";
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const deliveryClusterSchema = new Schema<IDeliveryCluster>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    center: { lat: { type: Number, required: true }, lng: { type: Number, required: true } },
    origin: { lat: Number, lng: Number },
    shape: { type: String, enum: ["circle", "square", "sector"], default: "sector" },
    radiusKm: { type: Number, default: 10, min: 0.5, max: 50 },
    cellSizeKm: { type: Number, min: 0.5, max: 20 },
    mainRadiusKm: { type: Number, min: 1, max: 100 },
    sectorStartDeg: { type: Number, min: 0, max: 360 },
    sectorEndDeg: { type: Number, min: 0, max: 360 },
    sectorCount: { type: Number, min: 2, max: 24 },
    description: String,
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

deliveryClusterSchema.index({ companyId: 1, code: 1 }, { unique: true });
deliveryClusterSchema.plugin(softDeletePlugin);

export const DeliveryCluster: Model<IDeliveryCluster> =
  mongoose.models.DeliveryCluster ??
  mongoose.model<IDeliveryCluster>("DeliveryCluster", deliveryClusterSchema);

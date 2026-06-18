import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export type BranchDocType =
  | "property_license"
  | "baladiya_license"
  | "pat_testing"
  | "smoke_alarm"
  | "building_insurance"
  | "fire_policy"
  | "money_policy"
  | "custom";

export interface IBranchDocument extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  type: BranchDocType;
  customTypeName?: string;
  issuanceDate?: Date;
  expiryDate?: Date;
  fileUrl?: string;
  status: "valid" | "expired" | "expiring_soon";
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const branchDocumentSchema = new Schema<IBranchDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    type: {
      type: String,
      enum: [
        "property_license",
        "baladiya_license",
        "pat_testing",
        "smoke_alarm",
        "building_insurance",
        "fire_policy",
        "money_policy",
        "custom",
      ],
      required: true,
    },
    customTypeName: String,
    issuanceDate: Date,
    expiryDate: Date,
    fileUrl: String,
    status: {
      type: String,
      enum: ["valid", "expired", "expiring_soon"],
      default: "valid",
    },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

branchDocumentSchema.plugin(softDeletePlugin);

export const BranchDocument: Model<IBranchDocument> =
  mongoose.models.BranchDocument ??
  mongoose.model<IBranchDocument>("BranchDocument", branchDocumentSchema);

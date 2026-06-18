import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export type BusinessDocType =
  | "cr_certificate"
  | "chamber_of_commerce"
  | "custom";

export interface IBusinessDocument extends Document {
  companyId: mongoose.Types.ObjectId;
  type: BusinessDocType;
  customTypeName?: string;
  startDate?: Date;
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

const businessDocumentSchema = new Schema<IBusinessDocument>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    type: {
      type: String,
      enum: ["cr_certificate", "chamber_of_commerce", "custom"],
      required: true,
    },
    customTypeName: String,
    startDate: Date,
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

businessDocumentSchema.plugin(softDeletePlugin);

export const BusinessDocument: Model<IBusinessDocument> =
  mongoose.models.BusinessDocument ??
  mongoose.model<IBusinessDocument>("BusinessDocument", businessDocumentSchema);

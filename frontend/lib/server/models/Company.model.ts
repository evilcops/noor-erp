import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export interface ICompany extends Document {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  taxId?: string;
  registrationNumber?: string;
  timezone: string;
  dateFormat: string;
  status: "active" | "inactive" | "suspended";
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    address: String,
    phone: String,
    email: String,
    logo: String,
    taxId: String,
    registrationNumber: String,
    timezone: { type: String, default: "Asia/Muscat" },
    dateFormat: { type: String, default: "DD/MM/YYYY" },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

companySchema.plugin(softDeletePlugin);

export const Company: Model<ICompany> =
  mongoose.models.Company ?? mongoose.model<ICompany>("Company", companySchema);

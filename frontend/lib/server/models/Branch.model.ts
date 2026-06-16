import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export interface IBranchHoliday {
  name: string;
  date: Date;
  isRecurring: boolean;
}

export interface IBranch extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  managerId?: mongoose.Types.ObjectId;
  gpsCoordinates?: { lat: number; lng: number };
  allowedRadius: number;
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
branchSchema.plugin(softDeletePlugin);

export const Branch: Model<IBranch> =
  mongoose.models.Branch ?? mongoose.model<IBranch>("Branch", branchSchema);

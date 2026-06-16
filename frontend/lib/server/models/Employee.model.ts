import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export interface IEmployeeDocument {
  _id?: mongoose.Types.ObjectId;
  type: "passport" | "visa" | "labour_card" | "id_card" | "contract" | "certificate";
  number?: string;
  fileUrl?: string;
  expiryDate?: Date;
  status: "valid" | "expired" | "expiring_soon";
  uploadedAt: Date;
  uploadedBy?: mongoose.Types.ObjectId;
}

export interface IEmployee extends Document {
  employeeId: string;
  userId?: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  department?: string;
  designation?: string;
  employmentType: "full_time" | "part_time" | "contract" | "intern";
  joiningDate?: Date;
  contractStartDate?: Date;
  contractEndDate?: Date;
  status: "active" | "on_leave" | "suspended" | "resigned" | "terminated" | "archived";
  documents: IEmployeeDocument[];
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const employeeSchema = new Schema<IEmployee>(
  {
    employeeId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    address: String,
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
    department: String,
    designation: String,
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "contract", "intern"],
      default: "full_time",
    },
    joiningDate: Date,
    contractStartDate: Date,
    contractEndDate: Date,
    status: {
      type: String,
      enum: ["active", "on_leave", "suspended", "resigned", "terminated", "archived"],
      default: "active",
    },
    documents: [
      {
        type: {
          type: String,
          enum: ["passport", "visa", "labour_card", "id_card", "contract", "certificate"],
        },
        number: String,
        fileUrl: String,
        expiryDate: Date,
        status: {
          type: String,
          enum: ["valid", "expired", "expiring_soon"],
          default: "valid",
        },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

employeeSchema.index({ companyId: 1, branchId: 1, status: 1 });
employeeSchema.plugin(softDeletePlugin);

export const Employee: Model<IEmployee> =
  mongoose.models.Employee ?? mongoose.model<IEmployee>("Employee", employeeSchema);

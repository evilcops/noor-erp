import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export type FamilyRelationship = "spouse" | "son" | "daughter" | "parents";

export interface IFamilyMemberDocument {
  issueDate?: Date;
  expiryDate?: Date;
  fileUrl?: string;
  status: "valid" | "expired" | "expiring_soon";
}

export interface IFamilyMember {
  _id?: mongoose.Types.ObjectId;
  name: string;
  profilePicture?: string;
  relationship: FamilyRelationship;
  bataka?: IFamilyMemberDocument;
}

export type ComplianceDocType =
  | "passport"
  | "driving_license"
  | "bataka"
  | "mulkiya"
  | "car_insurance";

export type LegacyDocType =
  | "visa"
  | "labour_card"
  | "id_card"
  | "contract"
  | "certificate";

export interface IEmployeeDocument {
  _id?: mongoose.Types.ObjectId;
  type: ComplianceDocType | LegacyDocType;
  number?: string;
  fileUrl?: string;
  issuanceDate?: Date;
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
  profilePicture?: string;
  hasVehicle?: boolean;
  familyType?: "individual" | "family";
  familyMembers?: IFamilyMember[];
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
    profilePicture: String,
    hasVehicle: { type: Boolean, default: false },
    familyType: { type: String, enum: ["individual", "family"], default: "individual" },
    familyMembers: [
      {
        name: { type: String, required: true },
        profilePicture: String,
        relationship: {
          type: String,
          enum: ["spouse", "son", "daughter", "parents"],
          required: true,
        },
        bataka: {
          issueDate: Date,
          expiryDate: Date,
          fileUrl: String,
          status: {
            type: String,
            enum: ["valid", "expired", "expiring_soon"],
            default: "valid",
          },
        },
      },
    ],
    documents: [
      {
        type: {
          type: String,
          enum: [
            "passport",
            "driving_license",
            "bataka",
            "pataka", // legacy — renamed to bataka; kept to prevent validation errors on old records until migration runs
            "mulkiya",
            "car_insurance",
            "visa",
            "labour_card",
            "id_card",
            "contract",
            "certificate",
          ],
        },
        number: String,
        fileUrl: String,
        issuanceDate: Date,
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

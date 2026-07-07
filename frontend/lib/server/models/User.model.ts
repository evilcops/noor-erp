import mongoose, { Schema, type Document, type Model } from "mongoose";
import { ROLES, type UserRole } from "../config/constants";
import { softDeletePlugin } from "./plugins/softDelete";

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  companyId?: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId;
  employeeId?: mongoose.Types.ObjectId;
  isActive: boolean;
  lastLogin?: Date;
  permissions: string[];
  useCustomPermissions: boolean;
  refreshTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: String,
    role: {
      type: String,
      enum: ROLES,
      required: true,
    },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    permissions: { type: [String], default: [] },
    useCustomPermissions: { type: Boolean, default: false },
    refreshTokenHash: { type: String, select: false },
  },
  { timestamps: true }
);

userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.plugin(softDeletePlugin);

// Re-register when schema changes (Next.js dev HMR keeps a stale cached model).
if (mongoose.models.User) {
  mongoose.deleteModel("User");
}

export const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);

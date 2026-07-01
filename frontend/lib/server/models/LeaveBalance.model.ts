import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ILeaveBalanceBucket {
  total: number;
  used: number;
  remaining: number;
}

export interface ILeaveBalance extends Document {
  employeeId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  year: number;
  annual: ILeaveBalanceBucket;
  sick: ILeaveBalanceBucket;
  emergency: ILeaveBalanceBucket;
  unpaid: ILeaveBalanceBucket;
  maternity: ILeaveBalanceBucket;
  paternity: ILeaveBalanceBucket;
  createdAt: Date;
  updatedAt: Date;
}

const bucketSchema = {
  total: { type: Number, default: 0 },
  used: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },
};

const leaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    year: { type: Number, required: true },
    annual: bucketSchema,
    sick: bucketSchema,
    emergency: bucketSchema,
    unpaid: bucketSchema,
    maternity: bucketSchema,
    paternity: bucketSchema,
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ employeeId: 1, year: 1 }, { unique: true });

export const LeaveBalance: Model<ILeaveBalance> =
  mongoose.models.LeaveBalance ??
  mongoose.model<ILeaveBalance>("LeaveBalance", leaveBalanceSchema);

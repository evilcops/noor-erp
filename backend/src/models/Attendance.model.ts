import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

export interface IAttendance extends Document {
  employeeId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  date: Date;
  timeIn?: Date;
  timeOut?: Date;
  totalHours?: number;
  locationIn?: { lat: number; lng: number; address?: string };
  locationOut?: { lat: number; lng: number; address?: string };
  deviceInfo?: string;
  isLate: boolean;
  lateMinutes: number;
  isEarlyLeave: boolean;
  earlyLeaveMinutes: number;
  isMissedCheckout: boolean;
  status:
    | "present"
    | "late"
    | "absent"
    | "half_day"
    | "on_leave"
    | "holiday"
    | "correction_pending"
    | "approved_correction";
  correctionRequest?: {
    requestedTimeIn?: Date;
    requestedTimeOut?: Date;
    reason?: string;
    requestedAt?: Date;
    approvedBy?: mongoose.Types.ObjectId;
    approvedAt?: Date;
    rejectionReason?: string;
  };
  approvedBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    date: { type: Date, required: true, index: true },
    timeIn: Date,
    timeOut: Date,
    totalHours: Number,
    locationIn: { lat: Number, lng: Number, address: String },
    locationOut: { lat: Number, lng: Number, address: String },
    deviceInfo: String,
    isLate: { type: Boolean, default: false },
    lateMinutes: { type: Number, default: 0 },
    isEarlyLeave: { type: Boolean, default: false },
    earlyLeaveMinutes: { type: Number, default: 0 },
    isMissedCheckout: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "present",
        "late",
        "absent",
        "half_day",
        "on_leave",
        "holiday",
        "correction_pending",
        "approved_correction",
      ],
      default: "present",
    },
    correctionRequest: {
      requestedTimeIn: Date,
      requestedTimeOut: Date,
      reason: String,
      requestedAt: Date,
      approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
      approvedAt: Date,
      rejectionReason: String,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.plugin(softDeletePlugin);

export const Attendance: Model<IAttendance> =
  mongoose.models.Attendance ??
  mongoose.model<IAttendance>("Attendance", attendanceSchema);

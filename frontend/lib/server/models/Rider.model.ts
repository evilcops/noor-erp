import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export type RiderFleetStatus =
  | "available"
  | "loading"
  | "on_delivery"
  | "returning_to_warehouse"
  | "break"
  | "offline"
  | "active"
  | "inactive"
  | "off_duty";

export interface IRider extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  riderCode: string;
  drivingLicenseNumber?: string;
  drivingLicenseExpiry?: Date;
  vehicleMake?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  whatsappPhone?: string;
  status: RiderFleetStatus;
  isOnJourney: boolean;
  isOnShift: boolean;
  shiftStartedAt?: Date;
  vehicleCapacityUnits: number;
  currentRunId?: mongoose.Types.ObjectId;
  predictedReturnAt?: Date;
  dailyDeliveriesCompleted: number;
  dailyKmTravelled: number;
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt: Date;
  };
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const riderSchema = new Schema<IRider>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, unique: true },
    riderCode: { type: String, required: true, trim: true },
    drivingLicenseNumber: String,
    drivingLicenseExpiry: Date,
    vehicleMake: String,
    vehicleModel: String,
    vehiclePlate: String,
    whatsappPhone: String,
    status: {
      type: String,
      enum: [
        "available",
        "loading",
        "on_delivery",
        "returning_to_warehouse",
        "break",
        "offline",
        "active",
        "inactive",
        "off_duty",
      ],
      default: "available",
    },
    isOnJourney: { type: Boolean, default: false },
    isOnShift: { type: Boolean, default: false },
    shiftStartedAt: Date,
    vehicleCapacityUnits: { type: Number, default: 20, min: 1 },
    currentRunId: { type: Schema.Types.ObjectId, ref: "DeliveryRun" },
    predictedReturnAt: Date,
    dailyDeliveriesCompleted: { type: Number, default: 0 },
    dailyKmTravelled: { type: Number, default: 0 },
    currentLocation: {
      lat: Number,
      lng: Number,
      updatedAt: Date,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

riderSchema.index({ companyId: 1, riderCode: 1 }, { unique: true });
riderSchema.plugin(softDeletePlugin);

if (mongoose.models.Rider) {
  mongoose.deleteModel("Rider");
}

export const Rider: Model<IRider> = mongoose.model<IRider>("Rider", riderSchema);

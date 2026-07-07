import mongoose, { Schema, type Document, type Model } from "mongoose";

export type DeliveryRunStatus =
  | "planning"
  | "loading"
  | "active"
  | "returning"
  | "completed"
  | "cancelled";

export interface IRunStop {
  deliveryId: mongoose.Types.ObjectId;
  order: number;
  lat: number;
  lng: number;
  estimatedArrival?: Date;
  isCurrentDestination?: boolean;
  isLocked?: boolean;
}

export interface IDeliveryRun extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  riderId: mongoose.Types.ObjectId;
  runNumber: string;
  status: DeliveryRunStatus;
  scheduledDate: Date;
  clusterIds: mongoose.Types.ObjectId[];
  startedAt?: Date;
  loadedAt?: Date;
  departedAt?: Date;
  endedAt?: Date;
  stops: IRunStop[];
  totalDistanceMeters?: number;
  totalDurationSeconds?: number;
  deliveriesPerKm?: number;
  grossMarginPerKm?: number;
  vehicleCapacityUsed?: number;
  assignmentLocked: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const deliveryRunSchema = new Schema<IDeliveryRun>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    riderId: { type: Schema.Types.ObjectId, ref: "Rider", required: true, index: true },
    runNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ["planning", "loading", "active", "returning", "completed", "cancelled"],
      default: "planning",
    },
    scheduledDate: { type: Date, required: true, index: true },
    clusterIds: [{ type: Schema.Types.ObjectId, ref: "DeliveryCluster" }],
    startedAt: Date,
    loadedAt: Date,
    departedAt: Date,
    endedAt: Date,
    stops: [
      {
        deliveryId: { type: Schema.Types.ObjectId, ref: "Delivery" },
        order: Number,
        lat: Number,
        lng: Number,
        estimatedArrival: Date,
        isCurrentDestination: { type: Boolean, default: false },
        isLocked: { type: Boolean, default: false },
      },
    ],
    totalDistanceMeters: Number,
    totalDurationSeconds: Number,
    deliveriesPerKm: Number,
    grossMarginPerKm: Number,
    vehicleCapacityUsed: Number,
    assignmentLocked: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

deliveryRunSchema.index({ companyId: 1, runNumber: 1 }, { unique: true });

export const DeliveryRun: Model<IDeliveryRun> =
  mongoose.models.DeliveryRun ??
  mongoose.model<IDeliveryRun>("DeliveryRun", deliveryRunSchema);

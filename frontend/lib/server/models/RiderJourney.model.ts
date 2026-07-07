import mongoose, { Schema, type Document, type Model } from "mongoose";

export type JourneyStatus = "active" | "completed" | "cancelled";

export interface IRouteStop {
  deliveryId: mongoose.Types.ObjectId;
  order: number;
  lat: number;
  lng: number;
  estimatedArrival?: Date;
}

export interface IRiderJourney extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  riderId: mongoose.Types.ObjectId;
  status: JourneyStatus;
  scheduledDate: Date;
  startedAt?: Date;
  endedAt?: Date;
  optimizedRoute: IRouteStop[];
  totalDistanceMeters?: number;
  totalDurationSeconds?: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const riderJourneySchema = new Schema<IRiderJourney>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    riderId: { type: Schema.Types.ObjectId, ref: "Rider", required: true, index: true },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },
    scheduledDate: { type: Date, required: true },
    startedAt: Date,
    endedAt: Date,
    optimizedRoute: [
      {
        deliveryId: { type: Schema.Types.ObjectId, ref: "Delivery" },
        order: Number,
        lat: Number,
        lng: Number,
        estimatedArrival: Date,
      },
    ],
    totalDistanceMeters: Number,
    totalDurationSeconds: Number,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const RiderJourney: Model<IRiderJourney> =
  mongoose.models.RiderJourney ??
  mongoose.model<IRiderJourney>("RiderJourney", riderJourneySchema);

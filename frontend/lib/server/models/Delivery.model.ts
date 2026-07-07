import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete";

export type DeliveryStatus =
  | "pending_assignment"
  | "scheduled"
  | "in_transit"
  | "delivered"
  | "failed"
  | "refused"
  | "rescheduled"
  | "cancelled";

export type DeliveryPriority = "low" | "normal" | "high" | "urgent";

export type WarehouseStatus =
  | "order_confirmed"
  | "picking"
  | "packing"
  | "ready_for_dispatch"
  | "waiting_for_rider"
  | "loaded"
  | "dispatched";

export type OrderSource =
  | "new_order"
  | "back_order"
  | "standing_daily"
  | "standing_weekly"
  | "standing_fortnightly"
  | "scheduled"
  | "previous_day"
  | "replenishment";

export interface IDeliveryWastage {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  reason?: string;
}

export interface IDelivery extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  saleId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  riderId?: mongoose.Types.ObjectId;
  provisionalRiderId?: mongoose.Types.ObjectId;
  journeyId?: mongoose.Types.ObjectId;
  runId?: mongoose.Types.ObjectId;
  clusterId?: mongoose.Types.ObjectId;
  deliveryNumber: string;
  orderSource: OrderSource;
  status: DeliveryStatus;
  warehouseStatus: WarehouseStatus;
  priority: DeliveryPriority;
  priorityScore: number;
  promisedWindowStart?: Date;
  promisedWindowEnd?: Date;
  promiseAcceptedAt?: Date;
  preparationMinutes?: number;
  scheduledDate?: Date;
  timeSlotStart?: Date;
  timeSlotEnd?: Date;
  routeOrder?: number;
  deliveryAddress?: string;
  area?: string;
  coordinates?: { lat: number; lng: number };
  estimatedArrival?: Date;
  actualDeliveryAt?: Date;
  assignmentLocked: boolean;
  currentDestinationLocked: boolean;
  queuePosition?: number;
  cashCollected?: number;
  digitalPaymentCollected?: number;
  cashHandedOver?: boolean;
  partialDeliveryQty?: number;
  failureReason?: string;
  notes?: string;
  proofOfDeliveryUrl?: string;
  signatureUrl?: string;
  voiceNoteUrl?: string;
  wastageItems: IDeliveryWastage[];
  whatsappSentAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const deliverySchema = new Schema<IDelivery>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    riderId: { type: Schema.Types.ObjectId, ref: "Rider", index: true },
    provisionalRiderId: { type: Schema.Types.ObjectId, ref: "Rider", index: true },
    journeyId: { type: Schema.Types.ObjectId, ref: "RiderJourney", index: true },
    runId: { type: Schema.Types.ObjectId, ref: "DeliveryRun", index: true },
    clusterId: { type: Schema.Types.ObjectId, ref: "DeliveryCluster", index: true },
    deliveryNumber: { type: String, required: true },
    orderSource: {
      type: String,
      enum: [
        "new_order",
        "back_order",
        "standing_daily",
        "standing_weekly",
        "standing_fortnightly",
        "scheduled",
        "previous_day",
        "replenishment",
      ],
      default: "new_order",
    },
    status: {
      type: String,
      enum: [
        "pending_assignment",
        "scheduled",
        "in_transit",
        "delivered",
        "failed",
        "refused",
        "rescheduled",
        "cancelled",
      ],
      default: "pending_assignment",
    },
    warehouseStatus: {
      type: String,
      enum: [
        "order_confirmed",
        "picking",
        "packing",
        "ready_for_dispatch",
        "waiting_for_rider",
        "loaded",
        "dispatched",
      ],
      default: "order_confirmed",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },
    priorityScore: { type: Number, default: 50 },
    promisedWindowStart: Date,
    promisedWindowEnd: Date,
    promiseAcceptedAt: Date,
    preparationMinutes: Number,
    scheduledDate: Date,
    timeSlotStart: Date,
    timeSlotEnd: Date,
    routeOrder: Number,
    deliveryAddress: String,
    area: String,
    coordinates: { lat: Number, lng: Number },
    estimatedArrival: Date,
    actualDeliveryAt: Date,
    assignmentLocked: { type: Boolean, default: false },
    currentDestinationLocked: { type: Boolean, default: false },
    queuePosition: Number,
    cashCollected: Number,
    digitalPaymentCollected: Number,
    cashHandedOver: { type: Boolean, default: false },
    partialDeliveryQty: Number,
    failureReason: String,
    notes: String,
    proofOfDeliveryUrl: String,
    signatureUrl: String,
    voiceNoteUrl: String,
    wastageItems: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, min: 0 },
        reason: String,
      },
    ],
    whatsappSentAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

deliverySchema.index({ companyId: 1, deliveryNumber: 1 }, { unique: true });
deliverySchema.index({ riderId: 1, scheduledDate: 1, timeSlotStart: 1 });
deliverySchema.index({ branchId: 1, warehouseStatus: 1, priorityScore: -1 });
deliverySchema.plugin(softDeletePlugin);

if (mongoose.models.Delivery) {
  mongoose.deleteModel("Delivery");
}

export const Delivery: Model<IDelivery> = mongoose.model<IDelivery>("Delivery", deliverySchema);

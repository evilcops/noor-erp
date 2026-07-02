import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  type:
    | "leave_request"
    | "leave_approved"
    | "attendance_late"
    | "document_expiry"
    | "performance_due"
    | "recruitment_update"
    | "low_stock"
    | "purchase_approval"
    | "stock_transfer"
    | "stock_received";
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", index: true },
    type: {
      type: String,
      enum: [
        "leave_request",
        "leave_approved",
        "attendance_late",
        "document_expiry",
        "performance_due",
        "recruitment_update",
        "low_stock",
        "purchase_approval",
        "stock_transfer",
        "stock_received",
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: Schema.Types.Mixed,
    isRead: { type: Boolean, default: false },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Notification: Model<INotification> =
  mongoose.models.Notification ??
  mongoose.model<INotification>("Notification", notificationSchema);

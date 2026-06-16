import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IAuditLog extends Document {
  companyId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: "create" | "update" | "delete" | "approve" | "reject" | "export";
  entityType: string;
  entityId: mongoose.Types.ObjectId;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  changes: { field: string; oldValue: unknown; newValue: unknown }[];
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  companyId: { type: Schema.Types.ObjectId, ref: "Company", index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  action: {
    type: String,
    enum: ["create", "update", "delete", "approve", "reject", "export"],
    required: true,
  },
  entityType: { type: String, required: true, index: true },
  entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  oldValue: Schema.Types.Mixed,
  newValue: Schema.Types.Mixed,
  changes: [
    {
      field: String,
      oldValue: Schema.Types.Mixed,
      newValue: Schema.Types.Mixed,
    },
  ],
  ipAddress: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now, index: true },
});

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ?? mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

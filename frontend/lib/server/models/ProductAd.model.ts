import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ProductAdLanguage = "en" | "ur" | "ar";
export type ProductAdStatus =
  | "pending"
  | "generating"
  | "ready"
  | "revision_requested"
  | "approved"
  | "broadcasting"
  | "broadcasted"
  | "failed";

export interface IProductAdBroadcastResult {
  customerId: mongoose.Types.ObjectId;
  channel: "email" | "whatsapp";
  status: "sent" | "skipped" | "failed";
  detail?: string;
}

export interface IProductAd extends Document {
  companyId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  language: ProductAdLanguage;
  prompt: string;
  durationSeconds: number;
  status: ProductAdStatus;
  openArtHistoryId?: string;
  openArtResourceIds: string[];
  videoUrl?: string;
  thumbnailUrl?: string;
  errorMessage?: string;
  /** Feedback from user when requesting a better version */
  revisionFeedback?: string;
  /** Previous ad this revision was based on */
  parentAdId?: mongoose.Types.ObjectId | null;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  broadcastAt?: Date;
  broadcastResults: IProductAdBroadcastResult[];
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const broadcastResultSchema = new Schema<IProductAdBroadcastResult>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    channel: { type: String, enum: ["email", "whatsapp"], required: true },
    status: { type: String, enum: ["sent", "skipped", "failed"], required: true },
    detail: String,
  },
  { _id: false }
);

const STATUS_ENUM = [
  "pending",
  "generating",
  "ready",
  "revision_requested",
  "approved",
  "broadcasting",
  "broadcasted",
  "failed",
] as const;

const productAdSchema = new Schema<IProductAd>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    language: { type: String, enum: ["en", "ur", "ar"], required: true },
    prompt: { type: String, required: true },
    durationSeconds: { type: Number, required: true, max: 9 },
    status: {
      type: String,
      enum: STATUS_ENUM,
      default: "pending",
      index: true,
    },
    openArtHistoryId: String,
    openArtResourceIds: { type: [String], default: [] },
    videoUrl: String,
    thumbnailUrl: String,
    errorMessage: String,
    revisionFeedback: String,
    parentAdId: { type: Schema.Types.ObjectId, ref: "ProductAd", default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    broadcastAt: Date,
    broadcastResults: { type: [broadcastResultSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

productAdSchema.index({ companyId: 1, productId: 1, createdAt: -1 });
productAdSchema.index({ companyId: 1, productId: 1, status: 1 });

export const ProductAd: Model<IProductAd> =
  mongoose.models.ProductAd ?? mongoose.model<IProductAd>("ProductAd", productAdSchema);

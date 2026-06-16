import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IPerformance extends Document {
  employeeId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  reviewerId: mongoose.Types.ObjectId;
  reviewCycle: string;
  rating?: number;
  strengths: string[];
  improvements: string[];
  goals: {
    description: string;
    deadline?: Date;
    status: "pending" | "in_progress" | "completed";
  }[];
  managerComments?: string;
  employeeComments?: string;
  nextReviewDate?: Date;
  status: "draft" | "pending_manager" | "completed" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const performanceSchema = new Schema<IPerformance>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewCycle: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5 },
    strengths: [String],
    improvements: [String],
    goals: [
      {
        description: String,
        deadline: Date,
        status: {
          type: String,
          enum: ["pending", "in_progress", "completed"],
          default: "pending",
        },
      },
    ],
    managerComments: String,
    employeeComments: String,
    nextReviewDate: Date,
    status: {
      type: String,
      enum: ["draft", "pending_manager", "completed", "archived"],
      default: "draft",
    },
  },
  { timestamps: true }
);

export const Performance: Model<IPerformance> =
  mongoose.models.Performance ??
  mongoose.model<IPerformance>("Performance", performanceSchema);

import mongoose, { Schema, type Document, type Model } from "mongoose";
import { softDeletePlugin } from "./plugins/softDelete.js";

export interface IRecruitment extends Document {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  position: string;
  department?: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  resumeUrl?: string;
  status:
    | "new"
    | "shortlisted"
    | "interview_scheduled"
    | "interviewed"
    | "offered"
    | "accepted"
    | "rejected"
    | "hired"
    | "archived";
  interviewSchedule?: {
    date?: Date;
    time?: string;
    mode?: "online" | "in_person";
    interviewerId?: mongoose.Types.ObjectId;
    meetingLink?: string;
    feedback?: string;
    rating?: number;
  };
  offerDetails?: {
    salary?: number;
    joiningDate?: Date;
    benefits?: string;
    status?: "pending" | "accepted" | "rejected";
  };
  notes?: string;
  documents: { type: string; url: string }[];
  hiredEmployeeId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const recruitmentSchema = new Schema<IRecruitment>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    position: { type: String, required: true },
    department: String,
    candidateName: { type: String, required: true },
    candidateEmail: { type: String, required: true, lowercase: true },
    candidatePhone: String,
    resumeUrl: String,
    status: {
      type: String,
      enum: [
        "new",
        "shortlisted",
        "interview_scheduled",
        "interviewed",
        "offered",
        "accepted",
        "rejected",
        "hired",
        "archived",
      ],
      default: "new",
    },
    interviewSchedule: {
      date: Date,
      time: String,
      mode: { type: String, enum: ["online", "in_person"] },
      interviewerId: { type: Schema.Types.ObjectId, ref: "User" },
      meetingLink: String,
      feedback: String,
      rating: Number,
    },
    offerDetails: {
      salary: Number,
      joiningDate: Date,
      benefits: String,
      status: { type: String, enum: ["pending", "accepted", "rejected"] },
    },
    notes: String,
    documents: [{ type: String, url: String }],
    hiredEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

recruitmentSchema.plugin(softDeletePlugin);

export const Recruitment: Model<IRecruitment> =
  mongoose.models.Recruitment ??
  mongoose.model<IRecruitment>("Recruitment", recruitmentSchema);

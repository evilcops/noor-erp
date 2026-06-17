import fs from "fs";
import path from "path";
import type { Request, Response } from "express";
import { Recruitment } from "../models/Recruitment.model";
import { Employee } from "../models/Employee.model";
import { generateEmployeeId } from "../services/auth.service";
import { buildTenantFilter } from "../services/permission.service";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

export async function addCandidate(req: Request, res: Response) {
  const candidate = await Recruitment.create({
    ...req.body,
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });
  return sendSuccess(res, candidate, 201);
}

export async function listCandidates(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.search) {
    filter.$or = [
      { candidateName: new RegExp(String(req.query.search), "i") },
      { candidateEmail: new RegExp(String(req.query.search), "i") },
      { position: new RegExp(String(req.query.search), "i") },
    ];
  }

  const [items, total] = await Promise.all([
    Recruitment.find(filter).sort(buildSortQuery(sortBy, sortOrder)).skip(skip).limit(limit).lean(),
    Recruitment.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getCandidate(req: Request, res: Response) {
  const candidate = await Recruitment.findById(req.params.id);
  if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found", 404);
  return sendSuccess(res, candidate);
}

export async function updateCandidate(req: Request, res: Response) {
  const candidate = await Recruitment.findById(req.params.id);
  if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found", 404);

  Object.assign(candidate, req.body, { updatedBy: req.user!._id });
  await candidate.save();
  return sendSuccess(res, candidate);
}

export async function updateCandidateStatus(req: Request, res: Response) {
  const candidate = await Recruitment.findById(req.params.id);
  if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found", 404);

  candidate.status = req.body.status;
  candidate.updatedBy = req.user!._id;
  await candidate.save();
  return sendSuccess(res, candidate);
}

export async function scheduleInterview(req: Request, res: Response) {
  const candidate = await Recruitment.findById(req.params.id);
  if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found", 404);

  candidate.interviewSchedule = {
    date: req.body.date ? new Date(req.body.date) : undefined,
    time: req.body.time,
    mode: req.body.mode,
    interviewerId: req.body.interviewerId ?? req.user!._id,
    meetingLink: req.body.meetingLink,
    feedback: candidate.interviewSchedule?.feedback,
    rating: candidate.interviewSchedule?.rating,
  };
  candidate.status = "interview_scheduled";
  candidate.updatedBy = req.user!._id;
  await candidate.save();
  return sendSuccess(res, candidate);
}

export async function interviewFeedback(req: Request, res: Response) {
  const candidate = await Recruitment.findById(req.params.id);
  if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found", 404);

  if (!req.body.feedback?.trim()) {
    throw new AppError("VALIDATION_ERROR", "Interview feedback is required", 400);
  }

  candidate.interviewSchedule = {
    ...candidate.interviewSchedule,
    feedback: req.body.feedback,
    rating: req.body.rating,
  };
  candidate.status = "interviewed";
  candidate.updatedBy = req.user!._id;
  await candidate.save();
  return sendSuccess(res, candidate);
}

export async function uploadCandidateCV(req: Request, res: Response) {
  const candidate = await Recruitment.findById(req.params.id);
  if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found", 404);

  if (!req.file) throw new AppError("VALIDATION_ERROR", "CV file required", 400);

  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(req.file.originalname) || ".pdf";
  const filename = `cv-${Date.now()}-${candidate._id}${ext}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), req.file.buffer);

  candidate.resumeUrl = `/api/uploads/${filename}`;
  candidate.updatedBy = req.user!._id;
  await candidate.save();

  return sendSuccess(res, candidate);
}

export async function convertToEmployee(req: Request, res: Response) {
  const candidate = await Recruitment.findById(req.params.id);
  if (!candidate) throw new AppError("NOT_FOUND", "Candidate not found", 404);
  if (candidate.hiredEmployeeId) {
    throw new AppError("CONFLICT", "Candidate already converted", 409);
  }

  const [firstName, ...rest] = candidate.candidateName.split(" ");
  const employeeId = await generateEmployeeId(String(candidate.companyId));

  const employee = await Employee.create({
    employeeId,
    companyId: candidate.companyId,
    branchId: candidate.branchId,
    firstName,
    lastName: rest.join(" ") || firstName,
    email: candidate.candidateEmail,
    phone: candidate.candidatePhone,
    department: candidate.department,
    designation: candidate.position,
    employmentType: "full_time",
    joiningDate: candidate.offerDetails?.joiningDate ?? new Date(),
    status: "active",
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });

  candidate.status = "hired";
  candidate.hiredEmployeeId = employee._id;
  await candidate.save();

  return sendSuccess(res, { candidate, employee }, 201);
}

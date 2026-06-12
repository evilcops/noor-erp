import type { Request, Response } from "express";
import {
  generateAttendanceReport,
  generateEmployeeReport,
  generateLeaveReport,
  generatePerformanceReport,
  generateRecruitmentReport,
} from "../services/report.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function employeeReport(req: Request, res: Response) {
  const data = await generateEmployeeReport(req.user!, req.query as Record<string, string>);
  return sendSuccess(res, data);
}

export async function attendanceReport(req: Request, res: Response) {
  const data = await generateAttendanceReport(req.user!, req.query as Record<string, string>);
  return sendSuccess(res, data);
}

export async function leaveReport(req: Request, res: Response) {
  const data = await generateLeaveReport(req.user!, req.query as Record<string, string>);
  return sendSuccess(res, data);
}

export async function recruitmentReport(req: Request, res: Response) {
  const data = await generateRecruitmentReport(req.user!, req.query as Record<string, string>);
  return sendSuccess(res, data);
}

export async function performanceReport(req: Request, res: Response) {
  const data = await generatePerformanceReport(req.user!, req.query as Record<string, string>);
  return sendSuccess(res, data);
}

import type { Request, Response } from "express";
import { Branch } from "../models/Branch.model.js";
import {
  assertBranchAccess,
  assertCompanyAccess,
  buildTenantFilter,
} from "../services/permission.service.js";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";

export async function createBranch(req: Request, res: Response) {
  assertCompanyAccess(req.user!, req.body.companyId);
  const branch = await Branch.create({
    ...req.body,
    code: req.body.code.toUpperCase(),
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });
  return sendSuccess(res, branch, 201);
}

export async function listBranches(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };
  if (req.query.companyId) filter.companyId = req.query.companyId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(String(req.query.search), "i") },
      { code: new RegExp(String(req.query.search), "i") },
    ];
  }

  const [items, total] = await Promise.all([
    Branch.find(filter).sort(buildSortQuery(sortBy, sortOrder)).skip(skip).limit(limit).lean(),
    Branch.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getBranch(req: Request, res: Response) {
  const branch = await Branch.findById(req.params.id);
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);
  assertBranchAccess(req.user!, branch._id, branch.companyId);
  return sendSuccess(res, branch);
}

export async function updateBranch(req: Request, res: Response) {
  const branch = await Branch.findById(req.params.id);
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);
  assertBranchAccess(req.user!, branch._id, branch.companyId);

  req.auditMeta = {
    entityType: "branch",
    oldValue: branch.toObject() as unknown as Record<string, unknown>,
  };
  Object.assign(branch, req.body, { updatedBy: req.user!._id });
  await branch.save();
  return sendSuccess(res, branch);
}

export async function deleteBranch(req: Request, res: Response) {
  const branch = await Branch.findById(req.params.id);
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);
  assertBranchAccess(req.user!, branch._id, branch.companyId);

  branch.deletedAt = new Date();
  branch.status = "inactive";
  await branch.save();
  return sendSuccess(res, { message: "Branch archived" });
}

export async function addBranchHoliday(req: Request, res: Response) {
  const branch = await Branch.findById(req.params.id);
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);
  assertBranchAccess(req.user!, branch._id, branch.companyId);

  branch.holidays.push({
    name: req.body.name,
    date: new Date(req.body.date),
    isRecurring: req.body.isRecurring ?? false,
  });
  await branch.save();
  return sendSuccess(res, branch);
}

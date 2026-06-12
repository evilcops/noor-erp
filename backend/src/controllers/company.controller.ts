import type { Request, Response } from "express";
import { Company } from "../models/Company.model.js";
import {
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

export async function createCompany(req: Request, res: Response) {
  const company = await Company.create({
    ...req.body,
    code: req.body.code.toUpperCase(),
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });
  return sendSuccess(res, company, 201);
}

export async function listCompanies(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(String(req.query.search), "i") },
      { code: new RegExp(String(req.query.search), "i") },
    ];
  }

  const [items, total] = await Promise.all([
    Company.find(filter)
      .sort(buildSortQuery(sortBy, sortOrder))
      .skip(skip)
      .limit(limit)
      .lean(),
    Company.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getCompany(req: Request, res: Response) {
  const company = await Company.findById(req.params.id);
  if (!company) throw new AppError("NOT_FOUND", "Company not found", 404);
  assertCompanyAccess(req.user!, company._id);
  return sendSuccess(res, company);
}

export async function updateCompany(req: Request, res: Response) {
  const company = await Company.findById(req.params.id);
  if (!company) throw new AppError("NOT_FOUND", "Company not found", 404);
  assertCompanyAccess(req.user!, company._id);

  req.auditMeta = {
    entityType: "company",
    oldValue: company.toObject() as unknown as Record<string, unknown>,
  };
  Object.assign(company, req.body, { updatedBy: req.user!._id });
  await company.save();
  return sendSuccess(res, company);
}

export async function deleteCompany(req: Request, res: Response) {
  const company = await Company.findById(req.params.id);
  if (!company) throw new AppError("NOT_FOUND", "Company not found", 404);
  assertCompanyAccess(req.user!, company._id);

  company.deletedAt = new Date();
  company.status = "inactive";
  await company.save();
  return sendSuccess(res, { message: "Company archived" });
}

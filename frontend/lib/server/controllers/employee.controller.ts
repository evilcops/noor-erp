import type { Request, Response } from "express";
import { Employee } from "../models/Employee.model";
import { generateEmployeeId } from "../services/auth.service";
import {
  assertBranchAccess,
  assertCompanyAccess,
  buildTenantFilter,
} from "../services/permission.service";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

export async function createEmployee(req: Request, res: Response) {
  assertCompanyAccess(req.user!, req.body.companyId);
  assertBranchAccess(req.user!, req.body.branchId, req.body.companyId);

  const employeeId = await generateEmployeeId(req.body.companyId);
  const employee = await Employee.create({
    ...req.body,
    employeeId,
    joiningDate: req.body.joiningDate ? new Date(req.body.joiningDate) : undefined,
    contractStartDate: req.body.contractStartDate
      ? new Date(req.body.contractStartDate)
      : undefined,
    contractEndDate: req.body.contractEndDate
      ? new Date(req.body.contractEndDate)
      : undefined,
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });
  return sendSuccess(res, employee, 201);
}

export async function listEmployees(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };
  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.$or = [
      { firstName: new RegExp(String(req.query.search), "i") },
      { lastName: new RegExp(String(req.query.search), "i") },
      { email: new RegExp(String(req.query.search), "i") },
      { employeeId: new RegExp(String(req.query.search), "i") },
    ];
  }

  const [items, total] = await Promise.all([
    Employee.find(filter).sort(buildSortQuery(sortBy, sortOrder)).skip(skip).limit(limit).lean(),
    Employee.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getEmployee(req: Request, res: Response) {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);
  assertBranchAccess(req.user!, employee.branchId, employee.companyId);
  return sendSuccess(res, employee);
}

export async function updateEmployee(req: Request, res: Response) {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);
  assertBranchAccess(req.user!, employee.branchId, employee.companyId);

  req.auditMeta = {
    entityType: "employee",
    oldValue: employee.toObject() as unknown as Record<string, unknown>,
  };
  Object.assign(employee, req.body, { updatedBy: req.user!._id });
  await employee.save();
  return sendSuccess(res, employee);
}

export async function deleteEmployee(req: Request, res: Response) {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);
  assertBranchAccess(req.user!, employee.branchId, employee.companyId);

  employee.deletedAt = new Date();
  employee.status = "archived";
  await employee.save();
  return sendSuccess(res, { message: "Employee archived" });
}

export async function uploadDocument(req: Request, res: Response) {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);
  assertBranchAccess(req.user!, employee.branchId, employee.companyId);

  if (!req.file) throw new AppError("VALIDATION_ERROR", "File required", 400);

  const doc = {
    type: req.body.type ?? "certificate",
    number: req.body.number,
    fileUrl: `/uploads/${req.file.originalname}`,
    expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
    status: "valid" as const,
    uploadedAt: new Date(),
    uploadedBy: req.user!._id,
  };

  employee.documents.push(doc);
  await employee.save();
  return sendSuccess(res, employee, 201);
}

export async function deleteDocument(req: Request, res: Response) {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);

  employee.documents = employee.documents.filter(
    (d) => String(d._id) !== req.params.docId
  );
  await employee.save();
  return sendSuccess(res, { message: "Document removed" });
}

export async function getExpiringDocuments(req: Request, res: Response) {
  const days = parseInt(String(req.query.days ?? "30"), 10);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + days);

  const filter = { ...buildTenantFilter(req.user!), deletedAt: null };
  const employees = await Employee.find(filter).lean();

  const expiring = employees.flatMap((emp) =>
    (emp.documents ?? [])
      .filter((d) => d.expiryDate && new Date(d.expiryDate) <= threshold)
      .map((d) => ({
        employeeId: emp._id,
        employeeCode: emp.employeeId,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        document: d,
      }))
  );

  return sendSuccess(res, expiring);
}

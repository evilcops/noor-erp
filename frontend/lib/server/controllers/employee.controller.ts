import fs from "fs";
import path from "path";
import type { Request, Response } from "express";
import { Employee } from "../models/Employee.model";
import type { ComplianceDocType } from "../models/Employee.model";
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

// Alert thresholds in days per document type group
const LONG_ALERT_DAYS = [274, 182, 91] as const;  // 9 months, 6 months, 3 months
const SHORT_ALERT_DAYS = [61, 30, 15] as const;    // 2 months, 1 month, 15 days
const LONG_ALERT_TYPES: ComplianceDocType[] = ["passport", "driving_license", "mulkiya"];
const SHORT_ALERT_TYPES: ComplianceDocType[] = ["pataka", "car_insurance"];
const MAX_THRESHOLD_DAYS = Math.max(...LONG_ALERT_DAYS, ...SHORT_ALERT_DAYS); // 274

function getAlertThresholdDays(type: string): readonly number[] {
  if (LONG_ALERT_TYPES.includes(type as ComplianceDocType)) return LONG_ALERT_DAYS;
  if (SHORT_ALERT_TYPES.includes(type as ComplianceDocType)) return SHORT_ALERT_DAYS;
  return SHORT_ALERT_DAYS; // default for legacy doc types
}

function resolveAlertLevel(
  daysRemaining: number,
  thresholds: readonly number[]
): "critical" | "warning" | "notice" | null {
  const [t1, t2, t3] = thresholds; // e.g. [274, 182, 91] or [61, 30, 15]
  if (daysRemaining <= t3) return "critical";
  if (daysRemaining <= t2) return "warning";
  if (daysRemaining <= t1) return "notice";
  return null;
}

interface ComplianceDocInput {
  issuanceDate?: string;
  expiryDate?: string;
}

function buildComplianceDocs(
  complianceDocs: Record<string, ComplianceDocInput | null | undefined> | undefined,
  hasVehicle: boolean,
  uploadedBy: string
) {
  if (!complianceDocs) return [];

  const alwaysVisible: ComplianceDocType[] = ["passport", "driving_license", "pataka"];
  const vehicleOnly: ComplianceDocType[] = ["mulkiya", "car_insurance"];
  const docTypes = hasVehicle ? [...alwaysVisible, ...vehicleOnly] : alwaysVisible;

  return docTypes.flatMap((type) => {
    const entry = complianceDocs[type];
    if (!entry) return [];
    return [
      {
        type,
        issuanceDate: entry.issuanceDate ? new Date(entry.issuanceDate) : undefined,
        expiryDate: entry.expiryDate ? new Date(entry.expiryDate) : undefined,
        status: "valid" as const,
        uploadedAt: new Date(),
        uploadedBy,
      },
    ];
  });
}

export async function createEmployee(req: Request, res: Response) {
  assertCompanyAccess(req.user!, req.body.companyId);
  assertBranchAccess(req.user!, req.body.branchId, req.body.companyId);

  const { complianceDocs, hasVehicle, ...rest } = req.body as {
    complianceDocs?: Record<string, ComplianceDocInput>;
    hasVehicle?: boolean;
    [key: string]: unknown;
  };

  const employeeId = await generateEmployeeId(req.body.companyId);
  const documents = buildComplianceDocs(
    complianceDocs,
    hasVehicle ?? false,
    String(req.user!._id)
  );

  const employee = await Employee.create({
    ...rest,
    employeeId,
    hasVehicle: hasVehicle ?? false,
    documents,
    joiningDate: rest.joiningDate ? new Date(String(rest.joiningDate)) : undefined,
    contractStartDate: rest.contractStartDate
      ? new Date(String(rest.contractStartDate))
      : undefined,
    contractEndDate: rest.contractEndDate
      ? new Date(String(rest.contractEndDate))
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

  const { complianceDocs, hasVehicle, ...rest } = req.body as {
    complianceDocs?: Record<string, ComplianceDocInput>;
    hasVehicle?: boolean;
    [key: string]: unknown;
  };

  // When hasVehicle changes, rebuild compliance documents
  if (complianceDocs !== undefined || hasVehicle !== undefined) {
    const effectiveHasVehicle = hasVehicle ?? employee.hasVehicle ?? false;
    const updatedComplianceDocs = buildComplianceDocs(
      complianceDocs,
      effectiveHasVehicle,
      String(req.user!._id)
    );

    const complianceTypes = [
      "passport",
      "driving_license",
      "pataka",
      "mulkiya",
      "car_insurance",
    ];
    const nonComplianceDocs = employee.documents.filter(
      (d) => !complianceTypes.includes(d.type)
    );
    employee.documents = [...nonComplianceDocs, ...updatedComplianceDocs] as typeof employee.documents;
    employee.hasVehicle = effectiveHasVehicle;
  }

  Object.assign(employee, rest, { updatedBy: req.user!._id });
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

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

async function persistFile(
  buffer: Buffer,
  originalname: string,
  employeeId: string,
  docType: string
): Promise<string> {
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(originalname) || ".bin";
  const safeName = `${Date.now()}-${employeeId}-${docType}${ext}`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, safeName), buffer);
  return `/api/uploads/${safeName}`;
}

export async function uploadDocument(req: Request, res: Response) {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);
  assertBranchAccess(req.user!, employee.branchId, employee.companyId);

  if (!req.file) throw new AppError("VALIDATION_ERROR", "File required", 400);

  const docType = String(req.body.type ?? "certificate");
  const fileUrl = await persistFile(
    req.file.buffer,
    req.file.originalname,
    String(employee._id),
    docType
  );

  const doc = {
    type: docType,
    number: req.body.number,
    fileUrl,
    issuanceDate: req.body.issuanceDate ? new Date(req.body.issuanceDate) : undefined,
    expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
    status: "valid" as const,
    uploadedAt: new Date(),
    uploadedBy: req.user!._id,
  };

  // For compliance doc types, replace the existing entry rather than appending
  const complianceTypes = [
    "passport",
    "driving_license",
    "pataka",
    "mulkiya",
    "car_insurance",
  ];
  if (complianceTypes.includes(doc.type)) {
    const existingIdx = employee.documents.findIndex((d) => d.type === doc.type);
    if (existingIdx >= 0) {
      Object.assign(employee.documents[existingIdx], doc);
    } else {
      employee.documents.push(doc);
    }
  } else {
    employee.documents.push(doc);
  }

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

/**
 * Returns all employee documents that are within an alert threshold.
 * Uses type-specific thresholds:
 *   passport, driving_license, mulkiya → 9 / 6 / 3 months
 *   pataka, car_insurance              → 2 months / 1 month / 15 days
 *
 * Pass ?days=N to override the outer window (useful for tighter dashboard queries).
 */
export async function getExpiringDocuments(req: Request, res: Response) {
  const requestedDays = req.query.days !== undefined
    ? parseInt(String(req.query.days), 10)
    : MAX_THRESHOLD_DAYS;

  const threshold = new Date();
  threshold.setDate(threshold.getDate() + requestedDays);

  const filter = { ...buildTenantFilter(req.user!), deletedAt: null };
  const employees = await Employee.find(filter).lean();
  const now = Date.now();

  const expiring = employees.flatMap((emp) =>
    (emp.documents ?? []).flatMap((d) => {
      if (!d.expiryDate) return [];

      const expiryMs = new Date(d.expiryDate).getTime();
      const daysRemaining = Math.ceil((expiryMs - now) / (1000 * 60 * 60 * 24));

      if (daysRemaining > requestedDays) return [];

      const thresholds = getAlertThresholdDays(d.type);
      const alertLevel = resolveAlertLevel(daysRemaining, thresholds);
      if (!alertLevel) return [];

      return [
        {
          employeeId: emp._id,
          employeeCode: emp.employeeId,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          document: d,
          daysRemaining,
          alertLevel,
        },
      ];
    })
  );

  return sendSuccess(res, expiring);
}

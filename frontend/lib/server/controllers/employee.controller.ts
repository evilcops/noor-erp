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

// Passport: 9 / 6 / 3 months; all other docs: 45 / 30 / 15 days
const PASSPORT_ALERT_DAYS = [274, 182, 91] as const;
const STD_ALERT_DAYS = [45, 30, 15] as const;
const MAX_THRESHOLD_DAYS = Math.max(...PASSPORT_ALERT_DAYS); // 274

function getAlertThresholdDays(type: string): readonly number[] {
  return type === "passport" ? PASSPORT_ALERT_DAYS : STD_ALERT_DAYS;
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

  const alwaysVisible: ComplianceDocType[] = ["passport", "driving_license", "bataka"];
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

  const { complianceDocs, hasVehicle, familyType, familyMembers, ...rest } = req.body as {
    complianceDocs?: Record<string, ComplianceDocInput>;
    hasVehicle?: boolean;
    familyType?: "individual" | "family";
    familyMembers?: Array<{
      _id?: string;
      name: string;
      relationship: string;
      profilePicture?: string;
      bataka?: { issueDate?: string; expiryDate?: string; fileUrl?: string; status?: string };
    }>;
    [key: string]: unknown;
  };

  // When hasVehicle changes, rebuild compliance documents
  if (complianceDocs !== undefined || hasVehicle !== undefined) {
    const effectiveHasVehicle = hasVehicle ?? employee.hasVehicle ?? false;
    const builtDocs = buildComplianceDocs(
      complianceDocs,
      effectiveHasVehicle,
      String(req.user!._id)
    );

    const complianceTypes = [
      "passport",
      "driving_license",
      "bataka",
      "mulkiya",
      "car_insurance",
    ];
    const nonComplianceDocs = employee.documents.filter(
      (d) => !complianceTypes.includes(d.type)
    );

    // Merge new date data with existing fileUrls — rebuilding must not lose uploaded files
    const mergedDocs = builtDocs.map((newDoc) => {
      const existing = employee.documents.find((d) => d.type === newDoc.type);
      return {
        ...newDoc,
        fileUrl: existing?.fileUrl ?? newDoc.fileUrl,
        uploadedAt: existing?.uploadedAt ?? newDoc.uploadedAt,
        uploadedBy: existing?.uploadedBy ?? newDoc.uploadedBy,
        _id: existing?._id,
      };
    });

    employee.documents = [...nonComplianceDocs, ...mergedDocs] as typeof employee.documents;
    employee.hasVehicle = effectiveHasVehicle;
  }

  // Update family type and members explicitly (Object.assign doesn't merge Mongoose subdoc arrays)
  if (familyType !== undefined) employee.familyType = familyType;
  if (familyMembers !== undefined) {
    // Preserve existing bataka.fileUrl for members that already have one
    employee.familyMembers = familyMembers.map((incoming) => {
      const existing = (employee.familyMembers ?? []).find(
        (m) => incoming._id && String(m._id) === incoming._id
      );
      return {
        ...incoming,
        bataka: incoming.bataka
          ? {
              ...incoming.bataka,
              // Keep previously uploaded file if no new one is specified
              fileUrl: incoming.bataka.fileUrl ?? existing?.bataka?.fileUrl,
              status: (incoming.bataka.status ?? existing?.bataka?.status ?? "valid") as "valid" | "expired" | "expiring_soon",
            }
          : existing?.bataka
          ? {
              issueDate: existing.bataka.issueDate,
              expiryDate: existing.bataka.expiryDate,
              fileUrl: existing.bataka.fileUrl,
              status: existing.bataka.status ?? "valid",
            }
          : undefined,
      };
    }) as typeof employee.familyMembers;
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

  const complianceTypes = [
    "passport",
    "driving_license",
    "bataka",
    "mulkiya",
    "car_insurance",
  ];

  if (complianceTypes.includes(docType)) {
    const existingIdx = employee.documents.findIndex((d) => d.type === docType);
    if (existingIdx >= 0) {
      // Selectively update — never overwrite dates/number with undefined from the upload request
      const existing = employee.documents[existingIdx];
      existing.fileUrl = fileUrl;
      existing.status = "valid";
      existing.uploadedAt = new Date();
      existing.uploadedBy = req.user!._id as typeof existing.uploadedBy;
      if (req.body.issuanceDate) existing.issuanceDate = new Date(req.body.issuanceDate);
      if (req.body.expiryDate) existing.expiryDate = new Date(req.body.expiryDate);
      if (req.body.number) existing.number = req.body.number;
    } else {
      employee.documents.push({
        type: docType as typeof employee.documents[0]["type"],
        fileUrl,
        issuanceDate: req.body.issuanceDate ? new Date(req.body.issuanceDate) : undefined,
        expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
        number: req.body.number,
        status: "valid",
        uploadedAt: new Date(),
        uploadedBy: req.user!._id as typeof employee.documents[0]["uploadedBy"],
      });
    }
  } else {
    employee.documents.push({
      type: docType as typeof employee.documents[0]["type"],
      fileUrl,
      issuanceDate: req.body.issuanceDate ? new Date(req.body.issuanceDate) : undefined,
      expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
      number: req.body.number,
      status: "valid",
      uploadedAt: new Date(),
      uploadedBy: req.user!._id as typeof employee.documents[0]["uploadedBy"],
    });
  }

  await employee.save();
  return sendSuccess(res, employee, 201);
}

export async function uploadFamilyBataka(req: Request, res: Response) {
  const employee = await Employee.findById(req.params.id);
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found", 404);
  assertBranchAccess(req.user!, employee.branchId, employee.companyId);

  // memberId comes from request body (flat route, no nested :memberId param)
  const memberId = String(req.body.memberId ?? req.query.memberId ?? "");
  if (!memberId) throw new AppError("VALIDATION_ERROR", "memberId is required", 400);

  const memberIdx = (employee.familyMembers ?? []).findIndex(
    (m) => String(m._id) === memberId
  );
  if (memberIdx === -1) throw new AppError("NOT_FOUND", "Family member not found", 404);
  const member = employee.familyMembers![memberIdx];

  if (!req.file) throw new AppError("VALIDATION_ERROR", "File required", 400);

  const fileUrl = await persistFile(
    req.file.buffer,
    req.file.originalname,
    String(employee._id),
    `family-bataka-${memberId}`
  );

  if (!member.bataka) {
    (member as Record<string, unknown>).bataka = { status: "valid", fileUrl };
  } else {
    member.bataka.fileUrl = fileUrl;
    member.bataka.status = "valid";
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
 *   bataka, car_insurance              → 2 months / 1 month / 15 days
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

  const expiring = employees.flatMap((emp) => {
    const employeeName = `${emp.firstName} ${emp.lastName}`;

    // Personal compliance documents
    const docAlerts = (emp.documents ?? []).flatMap((d) => {
      if (!d.expiryDate) return [];
      const daysRemaining = Math.ceil(
        (new Date(d.expiryDate).getTime() - now) / 86_400_000
      );
      if (daysRemaining > requestedDays) return [];
      const thresholds = getAlertThresholdDays(d.type);
      const alertLevel = resolveAlertLevel(daysRemaining, thresholds);
      if (!alertLevel) return [];
      return [{ employeeId: emp._id, employeeCode: emp.employeeId, employeeName, document: d, daysRemaining, alertLevel, isFamilyAlert: false }];
    });

    // Family member bataka alerts — message: "Visa expiring for the family of [Employee Name]"
    const familyAlerts = (emp.familyMembers ?? []).flatMap((member) => {
      if (!member.bataka?.expiryDate) return [];
      const daysRemaining = Math.ceil(
        (new Date(member.bataka.expiryDate).getTime() - now) / 86_400_000
      );
      if (daysRemaining > requestedDays) return [];
      const alertLevel = resolveAlertLevel(daysRemaining, STD_ALERT_DAYS);
      if (!alertLevel) return [];
      return [{
        employeeId: emp._id,
        employeeCode: emp.employeeId,
        employeeName: `Visa expiring for the family of ${employeeName}`,
        document: {
          type: "bataka" as const,
          expiryDate: member.bataka.expiryDate,
          status: "expiring_soon" as const,
          uploadedAt: new Date(),
        },
        daysRemaining,
        alertLevel,
        isFamilyAlert: true,
        familyMemberName: member.name,
      }];
    });

    return [...docAlerts, ...familyAlerts];
  });

  return sendSuccess(res, expiring);
}

import type { Types } from "mongoose";
import { Rider } from "../models/Rider.model";
import type { IEmployee } from "../models/Employee.model";
import { AppError } from "../utils/AppError";

export async function generateRiderCode(companyId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RDR-${year}-`;
  const last = await Rider.findOne({ companyId, riderCode: new RegExp(`^${prefix}`) })
    .sort({ riderCode: -1 })
    .select("riderCode")
    .lean();
  const next = last?.riderCode ? parseInt(last.riderCode.split("-").pop() ?? "0", 10) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function extractDrivingLicense(employee: IEmployee) {
  const doc = employee.documents?.find((d) => d.type === "driving_license");
  return {
    drivingLicenseNumber: doc?.number,
    drivingLicenseExpiry: doc?.expiryDate,
  };
}

export async function createRiderForEmployee(
  employee: IEmployee,
  createdBy: Types.ObjectId,
  overrides?: {
    vehicleMake?: string;
    vehicleModel?: string;
    vehiclePlate?: string;
    whatsappPhone?: string;
  }
) {
  const existing = await Rider.findOne({ employeeId: employee._id, deletedAt: null });
  if (existing) {
    throw new AppError("CONFLICT", "This employee is already registered as a rider", 409);
  }

  const license = extractDrivingLicense(employee);
  const riderCode = await generateRiderCode(String(employee.companyId));

  return Rider.create({
    companyId: employee.companyId,
    branchId: employee.branchId,
    employeeId: employee._id,
    riderCode,
    ...license,
    whatsappPhone: overrides?.whatsappPhone ?? employee.phone,
    vehicleMake: overrides?.vehicleMake,
    vehicleModel: overrides?.vehicleModel,
    vehiclePlate: overrides?.vehiclePlate,
    status: "active",
    createdBy,
    updatedBy: createdBy,
  });
}

export async function syncRiderFromEmployee(employee: IEmployee) {
  const rider = await Rider.findOne({ employeeId: employee._id, deletedAt: null });
  if (!rider) return null;

  const license = extractDrivingLicense(employee);
  rider.drivingLicenseNumber = license.drivingLicenseNumber ?? rider.drivingLicenseNumber;
  rider.drivingLicenseExpiry = license.drivingLicenseExpiry ?? rider.drivingLicenseExpiry;
  if (employee.phone) rider.whatsappPhone = employee.phone;
  rider.branchId = employee.branchId as Types.ObjectId;
  await rider.save();
  return rider;
}

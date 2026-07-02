import type { Types } from "mongoose";
import type { UserRole } from "../config/constants";
import { Employee, type IEmployee } from "../models/Employee.model";
import { User, type IUser } from "../models/User.model";
import { hashPassword } from "./auth.service";
import { AppError } from "../utils/AppError";

const MANAGEABLE_ROLES: Record<UserRole, UserRole[]> = {
  super_admin: ["super_admin", "business_owner", "branch_manager", "hr_manager", "inventory_manager", "procurement_manager", "employee"],
  business_owner: ["business_owner", "branch_manager", "hr_manager", "inventory_manager", "procurement_manager", "employee"],
  branch_manager: ["employee"],
  hr_manager: ["employee"],
  inventory_manager: ["employee"],
  procurement_manager: ["employee"],
  employee: [],
};

function assertCanAssignRole(actor: IUser, role: UserRole) {
  const allowed = MANAGEABLE_ROLES[actor.role as UserRole] ?? [];
  if (!allowed.includes(role)) {
    throw new AppError("FORBIDDEN", `You cannot assign the ${role} role`, 403);
  }
}

export async function createUserForEmployee(
  actor: IUser,
  employee: IEmployee,
  input: { password: string; role?: UserRole }
) {
  if (employee.userId) {
    throw new AppError("CONFLICT", "This employee already has a user account", 409);
  }

  const role: UserRole = input.role ?? "employee";
  if (role !== "employee") {
    assertCanAssignRole(actor, role);
  }

  const email = employee.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError("CONFLICT", "A user with this email already exists", 409);
  }

  const user = await User.create({
    email,
    password: await hashPassword(input.password),
    firstName: employee.firstName,
    lastName: employee.lastName,
    phone: employee.phone,
    role,
    companyId: employee.companyId as Types.ObjectId | undefined,
    branchId: employee.branchId as Types.ObjectId | undefined,
    employeeId: employee._id,
    useCustomPermissions: false,
    permissions: [],
  });

  employee.userId = user._id;
  await employee.save();

  return user;
}

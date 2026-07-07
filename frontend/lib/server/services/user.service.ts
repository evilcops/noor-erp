import mongoose, { type Types } from "mongoose";
import type { UserRole } from "../config/constants";
import { ROLE_PERMISSIONS } from "../config/constants";
import { User, type IUser } from "../models/User.model";
import { hashPassword } from "./auth.service";
import { assertPermission, buildTenantFilter } from "./permission.service";
import { AppError } from "../utils/AppError";

const MANAGEABLE_ROLES: Record<UserRole, UserRole[]> = {
  super_admin: ["super_admin", "business_owner", "branch_manager", "hr_manager", "inventory_manager", "procurement_manager", "rider", "employee"],
  business_owner: ["business_owner", "branch_manager", "hr_manager", "inventory_manager", "procurement_manager", "rider", "employee"],
  branch_manager: ["employee", "rider"],
  hr_manager: ["employee", "rider"],
  inventory_manager: ["employee", "rider"],
  procurement_manager: ["employee", "rider"],
  rider: [],
  employee: [],
};

function assertCanManageRole(actor: IUser, targetRole: UserRole) {
  const allowed = MANAGEABLE_ROLES[actor.role as UserRole] ?? [];
  if (!allowed.includes(targetRole)) {
    throw new AppError("FORBIDDEN", `You cannot assign the ${targetRole} role`, 403);
  }
}

function assertCanManageUser(actor: IUser, target: IUser) {
  if (actor.role === "super_admin") return;
  if (target.role === "super_admin") {
    throw new AppError("FORBIDDEN", "You cannot manage super admin users", 403);
  }
  if (actor.companyId && target.companyId && String(actor.companyId) !== String(target.companyId)) {
    throw new AppError("FORBIDDEN", "User is outside your company", 403);
  }
}

function resolveCompanyId(actor: IUser, companyId?: string) {
  if (actor.role === "super_admin") return companyId ?? actor.companyId;
  return actor.companyId;
}

export async function listUsers(
  actor: IUser,
  query: {
    page: number;
    limit: number;
    skip: number;
    search?: string;
    role?: string;
  }
) {
  assertPermission(actor, "view", "user");

  const filter: Record<string, unknown> = { ...buildTenantFilter(actor), deletedAt: null };
  if (actor.role !== "super_admin") {
    filter.role = { $ne: "super_admin" };
  }
  if (query.role) filter.role = query.role;
  if (query.search) {
    filter.$or = [
      { firstName: new RegExp(query.search, "i") },
      { lastName: new RegExp(query.search, "i") },
      { email: new RegExp(query.search, "i") },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .select("-password -refreshTokenHash")
      .sort({ createdAt: -1 })
      .skip(query.skip)
      .limit(query.limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return { items, total };
}

export async function getUserById(actor: IUser, id: string) {
  assertPermission(actor, "view", "user");
  const user = await User.findById(id).select("-password -refreshTokenHash");
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  assertCanManageUser(actor, user);
  return user;
}

export async function createUser(
  actor: IUser,
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    role: UserRole;
    companyId?: string;
    branchId?: string;
    useCustomPermissions?: boolean;
    permissions?: string[];
  }
) {
  assertPermission(actor, "create", "user");
  assertCanManageRole(actor, input.role);

  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new AppError("CONFLICT", "Email already registered", 409);

  const companyId = resolveCompanyId(actor, input.companyId);
  if (actor.role !== "super_admin" && !companyId) {
    throw new AppError("BAD_REQUEST", "Company is required", 400);
  }

  const user = await User.create({
    email: input.email.toLowerCase(),
    password: await hashPassword(input.password),
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    role: input.role,
    companyId: companyId as Types.ObjectId | undefined,
    branchId: input.branchId as Types.ObjectId | undefined,
    useCustomPermissions: input.useCustomPermissions ?? false,
    permissions: input.useCustomPermissions ? (input.permissions ?? []) : [],
  });

  const doc = user.toObject();
  delete (doc as { password?: string }).password;
  return doc;
}

export async function updateUser(
  actor: IUser,
  id: string,
  input: {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    role?: UserRole;
    companyId?: string;
    branchId?: string;
    isActive?: boolean;
    useCustomPermissions?: boolean;
    permissions?: string[];
  }
) {
  assertPermission(actor, "edit", "user");

  const user = await User.findById(id);
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  assertCanManageUser(actor, user);

  if (input.role) {
    assertCanManageRole(actor, input.role);
    user.role = input.role;
  }

  if (input.email) user.email = input.email.toLowerCase();
  if (input.firstName) user.firstName = input.firstName;
  if (input.lastName) user.lastName = input.lastName;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.isActive !== undefined) user.isActive = input.isActive;
  if (input.branchId !== undefined) {
    user.branchId = input.branchId
      ? new mongoose.Types.ObjectId(input.branchId)
      : undefined;
  }
  if (input.password) user.password = await hashPassword(input.password);

  if (input.useCustomPermissions !== undefined) {
    user.useCustomPermissions = input.useCustomPermissions;
    if (!input.useCustomPermissions) {
      user.permissions = [];
    }
  }
  if (input.permissions !== undefined && user.useCustomPermissions) {
    user.permissions = input.permissions;
  }

  await user.save();

  const doc = user.toObject();
  delete (doc as { password?: string }).password;
  return doc;
}

export async function deleteUser(actor: IUser, id: string) {
  assertPermission(actor, "delete", "user");

  const user = await User.findById(id);
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  assertCanManageUser(actor, user);

  if (String(user._id) === String(actor._id)) {
    throw new AppError("BAD_REQUEST", "You cannot deactivate your own account", 400);
  }

  user.isActive = false;
  user.deletedAt = new Date();
  await user.save();

  return { message: "User deactivated" };
}

export function getRoleDefinitions() {
  return Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
    role,
    permissions,
  }));
}

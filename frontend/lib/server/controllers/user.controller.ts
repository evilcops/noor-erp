import type { Request, Response } from "express";
import {
  createUser,
  deleteUser,
  getRoleDefinitions,
  getUserById,
  listUsers,
  updateUser,
} from "../services/user.service";
import { getUserPermissions } from "../services/permission.service";
import { buildMeta, parsePagination, sendSuccess } from "../utils/apiResponse";

function formatUser(user: Record<string, unknown>) {
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    phone: user.phone,
    role: user.role,
    companyId: user.companyId,
    branchId: user.branchId,
    employeeId: user.employeeId,
    isActive: user.isActive,
    lastLogin: user.lastLogin,
    useCustomPermissions: user.useCustomPermissions ?? false,
    permissions: user.permissions ?? [],
    createdAt: user.createdAt,
  };
}

export async function listUsersHandler(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query);
  const result = await listUsers(req.user!, {
    page,
    limit,
    skip,
    search: req.query.search as string | undefined,
    role: req.query.role as string | undefined,
  });

  const items = result.items.map((u) => ({
    ...formatUser(u as unknown as Record<string, unknown>),
    effectivePermissions: getUserPermissions(u as unknown as Parameters<typeof getUserPermissions>[0]),
  }));

  return sendSuccess(res, items, 200, buildMeta(page, limit, result.total));
}

export async function getUserHandler(req: Request, res: Response) {
  const user = await getUserById(req.user!, String(req.params.id));
  return sendSuccess(res, {
    ...formatUser(user.toObject() as unknown as Record<string, unknown>),
    effectivePermissions: getUserPermissions(user as unknown as Parameters<typeof getUserPermissions>[0]),
  });
}

export async function createUserHandler(req: Request, res: Response) {
  const user = await createUser(req.user!, req.body);
  return sendSuccess(res, formatUser(user as unknown as Record<string, unknown>), 201);
}

export async function updateUserHandler(req: Request, res: Response) {
  const user = await updateUser(req.user!, String(req.params.id), req.body);
  return sendSuccess(res, formatUser(user as unknown as Record<string, unknown>));
}

export async function deleteUserHandler(req: Request, res: Response) {
  const result = await deleteUser(req.user!, String(req.params.id));
  return sendSuccess(res, result);
}

export async function roleDefinitionsHandler(_req: Request, res: Response) {
  return sendSuccess(res, getRoleDefinitions());
}

import { verifyAccessToken } from "@/lib/auth/jwt";
import { getAccessTokenFromCookies } from "@/lib/auth/cookies";
import type { AuthUser } from "@/types";

export async function getSessionUser(): Promise<AuthUser | null> {
  const token = await getAccessTokenFromCookies();
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  return {
    id: payload.sub,
    email: payload.email,
    fullName: "",
    role: payload.role,
    companyId: payload.companyId,
    branchId: payload.branchId,
  };
}

export function authUserFromPayload(payload: {
  sub: string;
  email: string;
  role: string;
  companyId: string | null;
  branchId: string | null;
}): AuthUser {
  return {
    id: payload.sub,
    email: payload.email,
    fullName: "",
    role: payload.role,
    companyId: payload.companyId,
    branchId: payload.branchId,
  };
}

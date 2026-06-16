import type { UserRole } from "@/types/auth-user";

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  branchId: string | null;
  type: "access" | "refresh";
}

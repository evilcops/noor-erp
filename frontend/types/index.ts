export type {
  Company,
  Branch,
  User,
  RefreshToken,
  UserRole,
  RecordStatus,
} from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  companyId: string | null;
  branchId: string | null;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

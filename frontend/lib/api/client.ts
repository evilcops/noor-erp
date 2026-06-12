import { API_BASE_URL } from "@/lib/api/config";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/api/token";
import type { ApiResponse } from "@/types/api";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const json = (await res.json()) as ApiResponse<{
    accessToken: string;
    refreshToken: string;
  }>;

  if (!json.success) {
    clearTokens();
    return null;
  }

  setTokens(json.data.accessToken, json.data.refreshToken);
  return json.data.accessToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiRequest<T>(path, options, false);
    }
    if (typeof window !== "undefined") {
      window.location.href = "/login?expired=1";
    }
    throw new ApiClientError("Session expired", "UNAUTHORIZED", 401);
  }

  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new ApiClientError(
      json.error.message,
      json.error.code,
      res.status,
      json.error.details
    );
  }

  return json.data;
}

export async function apiRequestWithMeta<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; meta?: { page: number; limit: number; total: number; totalPages: number } }> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const json = (await res.json()) as ApiResponse<T> & { meta?: { page: number; limit: number; total: number; totalPages: number } };

  if (!json.success) {
    throw new ApiClientError(json.error.message, json.error.code, res.status, json.error.details);
  }

  return { data: json.data, meta: json.meta };
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

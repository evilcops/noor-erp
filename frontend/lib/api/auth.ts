import { API_BASE_URL } from "@/lib/api/config";
import { apiRequest, ApiClientError } from "@/lib/api/client";
import { setTokens, clearTokens } from "@/lib/api/token";
import type { ApiResponse } from "@/types/api";
import type { ApiUser, LoginResult } from "@/types/auth-user";

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json()) as ApiResponse<LoginResult>;
    if (!json.success) {
      throw new ApiClientError(json.error.message, json.error.code, res.status);
    }
    setTokens(json.data.accessToken, json.data.refreshToken);
    return json.data;
  },

  me: () => apiRequest<{ user: ApiUser & { permissions: string[] } }>("/auth/me"),

  logout: async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      clearTokens();
    }
  },
};

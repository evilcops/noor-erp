const ACCESS_KEY = "noor_access_token";
const REFRESH_KEY = "noor_refresh_token";
const ACCESS_COOKIE = "noor_api_access";
const ACCESS_MAX_AGE = 24 * 60 * 60; // 1 day — matches JWT access token TTL

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

function setAccessCookie(accessToken: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  document.cookie = `${ACCESS_COOKIE}=${encodeURIComponent(accessToken)}; path=/; max-age=${ACCESS_MAX_AGE}; SameSite=Lax${secure}`;
  document.cookie = `noor_access_token=${encodeURIComponent(accessToken)}; path=/; max-age=${ACCESS_MAX_AGE}; SameSite=Lax${secure}`;
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  setAccessCookie(accessToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  document.cookie = `${ACCESS_COOKIE}=; path=/; max-age=0`;
  document.cookie = "noor_access_token=; path=/; max-age=0";
}

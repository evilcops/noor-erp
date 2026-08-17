import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/register", "/store"];
const AUTH_PATHS = ["/login", "/register"];
const STORE_AUTH_PATHS = ["/store/login", "/store/register"];
const STORE_APP_URL = process.env.NEXT_PUBLIC_STORE_URL ?? "http://localhost:3001";

function getSecrets(): Uint8Array[] {
  return [
    process.env.JWT_SECRET,
    process.env.JWT_ACCESS_SECRET,
    process.env.EXPRESS_JWT_SECRET,
    "dev-jwt-secret-change-in-production-32chars",
    "your-super-secret-key-change-this-min-32-chars",
  ]
    .filter(Boolean)
    .map((secret) => new TextEncoder().encode(secret as string));
}

async function verifyAccessToken(token: string): Promise<{ role?: string } | null> {
  for (const secret of getSecrets()) {
    try {
      const { payload } = await jwtVerify(token, secret);
      if (payload.type === "access" || payload.sub) {
        return { role: typeof payload.role === "string" ? payload.role : undefined };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)
  ) {
    return NextResponse.next();
  }

  const isStorePath = pathname === "/store" || pathname.startsWith("/store/");
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  const rawToken =
    request.cookies.get("noor_api_access")?.value ??
    request.cookies.get("noor_access_token")?.value;
  const accessToken = rawToken
    ? (() => {
        try {
          return decodeURIComponent(rawToken);
        } catch {
          return rawToken;
        }
      })()
    : undefined;
  const tokenPayload = accessToken ? await verifyAccessToken(accessToken) : null;
  const isAuthenticated = Boolean(tokenPayload);
  const isCustomer = tokenPayload?.role === "customer";
  const homePath = isCustomer ? STORE_APP_URL : tokenPayload?.role === "rider" ? "/riders" : "/";

  // Customers use the dedicated store app — bounce them off the ERP UI.
  if (isCustomer && !isStorePath) {
    return NextResponse.redirect(STORE_APP_URL);
  }

  if ((AUTH_PATHS.includes(pathname) || STORE_AUTH_PATHS.includes(pathname)) && isAuthenticated) {
    if (isCustomer) return NextResponse.redirect(STORE_APP_URL);
    return NextResponse.redirect(new URL(homePath, request.url));
  }

  if (isAuthenticated && tokenPayload?.role === "rider" && pathname === "/") {
    return NextResponse.redirect(new URL("/riders", request.url));
  }

  if (!isPublic && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

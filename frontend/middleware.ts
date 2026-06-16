import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/register"];
const AUTH_PATHS = ["/login", "/register"];

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

async function isValidAccessToken(token: string): Promise<boolean> {
  for (const secret of getSecrets()) {
    try {
      const { payload } = await jwtVerify(token, secret);
      if (payload.type === "access" || payload.sub) return true;
    } catch {
      continue;
    }
  }
  return false;
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
  const isAuthenticated = accessToken ? await isValidAccessToken(accessToken) : false;

  if (AUTH_PATHS.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
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

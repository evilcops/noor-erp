import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = [
  "/login",
  "/register",
];
const AUTH_PATHS = ["/login", "/register"];

function getSecrets(): Uint8Array[] {
  const secrets = [
    process.env.JWT_ACCESS_SECRET,
    process.env.EXPRESS_JWT_SECRET,
    "your-super-secret-key-change-this-min-32-chars",
  ].filter(Boolean) as string[];
  return secrets.map((s) => new TextEncoder().encode(s));
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
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  const accessToken =
    request.cookies.get("noor_api_access")?.value ??
    request.cookies.get("noor_access_token")?.value;
  const isAuthenticated = accessToken
    ? await isValidAccessToken(accessToken)
    : false;

  if (AUTH_PATHS.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isPublic && !isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

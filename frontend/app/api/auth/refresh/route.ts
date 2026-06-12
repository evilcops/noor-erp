import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "@/lib/auth/jwt";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "@/lib/auth/cookies";
import { jsonError, jsonSuccess } from "@/lib/api/response";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return jsonError("Refresh token missing", 401);
  }

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    return jsonError("Invalid refresh token", 401);
  }

  const stored = await prisma.refreshToken.findFirst({
    where: {
      userId: payload.sub,
      tokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!stored) {
    return jsonError("Refresh token revoked or expired", 401);
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, deletedAt: null, status: "ACTIVE" },
  });

  if (!user) {
    return jsonError("User not found", 401);
  }

  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    branchId: user.branchId,
  };

  const { token: accessToken, expiresIn } =
    await signAccessToken(tokenPayload);
  const newRefreshToken = await signRefreshToken(tokenPayload);

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const refreshExpiresDays = parseInt(
    process.env.JWT_REFRESH_EXPIRES_IN?.replace(/\D/g, "") || "7",
    10
  );

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(
        Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000
      ),
    },
  });

  cookieStore.set(
    ACCESS_TOKEN_COOKIE,
    accessToken,
    accessTokenCookieOptions(expiresIn)
  );
  cookieStore.set(
    REFRESH_TOKEN_COOKIE,
    newRefreshToken,
    refreshTokenCookieOptions(refreshExpiresDays * 24 * 60 * 60)
  );

  return jsonSuccess({ accessToken, expiresIn });
}

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken, hashToken } from "@/lib/auth/jwt";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
} from "@/lib/auth/cookies";
import { loginSchema } from "@/lib/validations/auth";
import { handleApiError, jsonError, jsonSuccess } from "@/lib/api/response";
import type { LoginResponse } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
        status: "ACTIVE",
      },
    });

    if (!user) {
      return jsonError("Invalid email or password", 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return jsonError("Invalid email or password", 401);
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
    const refreshToken = await signRefreshToken(tokenPayload);

    const refreshExpiresDays = parseInt(
      process.env.JWT_REFRESH_EXPIRES_IN?.replace(/\D/g, "") || "7",
      10
    );

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(
          Date.now() + refreshExpiresDays * 24 * 60 * 60 * 1000
        ),
      },
    });

    const cookieStore = await cookies();
    cookieStore.set(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      accessTokenCookieOptions(expiresIn)
    );
    cookieStore.set(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      refreshTokenCookieOptions(refreshExpiresDays * 24 * 60 * 60)
    );

    const response: LoginResponse = {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        branchId: user.branchId,
      },
      accessToken,
      expiresIn,
    };

    return jsonSuccess(response);
  } catch (error) {
    return handleApiError(error);
  }
}

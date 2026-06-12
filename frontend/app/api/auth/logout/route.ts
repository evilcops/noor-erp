import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { hashToken, verifyRefreshToken } from "@/lib/auth/jwt";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/auth/cookies";
import { jsonSuccess } from "@/lib/api/response";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    const payload = await verifyRefreshToken(refreshToken);
    if (payload) {
      await prisma.refreshToken.updateMany({
        where: {
          userId: payload.sub,
          tokenHash: hashToken(refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }
  }

  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);

  return jsonSuccess({ message: "Logged out successfully" });
}

import { prisma } from "@/lib/db";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { getAccessTokenFromCookies } from "@/lib/auth/cookies";
import { jsonError, jsonSuccess } from "@/lib/api/response";

export async function GET() {
  const token = await getAccessTokenFromCookies();
  if (!token) {
    return jsonError("Unauthorized", 401);
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return jsonError("Invalid or expired token", 401);
  }

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      companyId: true,
      branchId: true,
      status: true,
    },
  });

  if (!user) {
    return jsonError("User not found", 404);
  }

  return jsonSuccess({ user });
}

import fs from "fs";
import path from "path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { connectDatabase } from "@/lib/server/config/database";
import { User } from "@/lib/server/models/User.model";
import { verifyAccessToken } from "@/lib/server/services/auth.service";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);

  // Cookie fallback — written by token.ts setAccessCookie()
  const cookie = request.cookies.get("noor_access_token");
  if (cookie?.value) return decodeURIComponent(cookie.value);

  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  // Auth
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDatabase();
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user?.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await context.params;

  // Guard against path traversal
  if (!filename || filename.includes("/") || filename.includes("..") || filename.includes("\\")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = await fs.promises.readFile(filePath);
  const ext = path.extname(filename).slice(1).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";
  const isInline = ["pdf", "png", "jpg", "jpeg", "gif", "webp"].includes(ext);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}

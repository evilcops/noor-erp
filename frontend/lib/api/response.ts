import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError("Validation failed", 422, error.flatten().fieldErrors);
  }

  console.error("[API Error]", error);
  return jsonError("Internal server error", 500);
}

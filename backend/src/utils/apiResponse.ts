import type { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: PaginationMeta
) {
  return res.status(status).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  status = 400,
  details?: unknown
) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20)
  );
  const sortBy = String(query.sortBy ?? "createdAt");
  const sortOrder = (String(query.sortOrder ?? "desc") === "asc" ? 1 : -1) as 1 | -1;
  const skip = (page - 1) * limit;
  return { page, limit, sortBy, sortOrder, skip };
}

export function buildSortQuery(
  sortBy: string,
  sortOrder: 1 | -1
): Record<string, 1 | -1> {
  return { [sortBy]: sortOrder };
}

export function buildMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

import type { Request, Response } from "express";
import { Performance } from "../models/Performance.model.js";
import { buildTenantFilter } from "../services/permission.service.js";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";

export async function createReview(req: Request, res: Response) {
  const review = await Performance.create({
    ...req.body,
    reviewerId: req.user!._id,
    status: "draft",
  });
  return sendSuccess(res, review, 201);
}

export async function listReviews(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!) };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.employeeId) filter.employeeId = req.query.employeeId;

  const [items, total] = await Promise.all([
    Performance.find(filter)
      .sort(buildSortQuery(sortBy, sortOrder))
      .skip(skip)
      .limit(limit)
      .populate("employeeId", "firstName lastName employeeId")
      .lean(),
    Performance.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function getReview(req: Request, res: Response) {
  const review = await Performance.findById(req.params.id).populate(
    "employeeId",
    "firstName lastName"
  );
  if (!review) throw new AppError("NOT_FOUND", "Review not found", 404);
  return sendSuccess(res, review);
}

export async function updateReview(req: Request, res: Response) {
  const review = await Performance.findById(req.params.id);
  if (!review) throw new AppError("NOT_FOUND", "Review not found", 404);

  Object.assign(review, req.body);
  await review.save();
  return sendSuccess(res, review);
}

export async function submitReview(req: Request, res: Response) {
  const review = await Performance.findById(req.params.id);
  if (!review) throw new AppError("NOT_FOUND", "Review not found", 404);

  review.status = "pending_manager";
  await review.save();
  return sendSuccess(res, review);
}

export async function completeReview(req: Request, res: Response) {
  const review = await Performance.findById(req.params.id);
  if (!review) throw new AppError("NOT_FOUND", "Review not found", 404);

  review.status = "completed";
  if (req.body.managerComments) review.managerComments = req.body.managerComments;
  if (req.body.rating) review.rating = req.body.rating;
  await review.save();
  return sendSuccess(res, review);
}

export async function getMyReviews(req: Request, res: Response) {
  if (!req.user!.employeeId) {
    return sendSuccess(res, []);
  }
  const reviews = await Performance.find({ employeeId: req.user!.employeeId })
    .sort({ createdAt: -1 })
    .lean();
  return sendSuccess(res, reviews);
}

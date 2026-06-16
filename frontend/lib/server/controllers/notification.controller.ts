import type { Request, Response } from "express";
import { Notification } from "../models/Notification.model";
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notification.service";
import { buildMeta, parsePagination, sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

export async function listNotifications(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query);
  const result = await getUserNotifications(req.user!._id, page, limit);
  return sendSuccess(
    res,
    { items: result.items, unreadCount: result.unreadCount },
    200,
    buildMeta(page, limit, result.total)
  );
}

export async function markRead(req: Request, res: Response) {
  const notification = await markNotificationRead(
    req.user!._id,
    String(req.params.id)
  );
  if (!notification) throw new AppError("NOT_FOUND", "Notification not found", 404);
  return sendSuccess(res, notification);
}

export async function markAllRead(req: Request, res: Response) {
  await markAllNotificationsRead(req.user!._id);
  return sendSuccess(res, { message: "All notifications marked as read" });
}

export async function deleteNotification(req: Request, res: Response) {
  const result = await Notification.findOneAndDelete({
    _id: req.params.id,
    userId: req.user!._id,
  });
  if (!result) throw new AppError("NOT_FOUND", "Notification not found", 404);
  return sendSuccess(res, { message: "Notification deleted" });
}

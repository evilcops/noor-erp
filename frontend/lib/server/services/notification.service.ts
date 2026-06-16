import type { Types } from "mongoose";
import { Notification } from "../models/Notification.model";
import type { INotification } from "../models/Notification.model";
import { sendEmailNotification } from "./email.service";

export async function createNotification(input: {
  userId: Types.ObjectId | string;
  companyId?: Types.ObjectId | string;
  type: INotification["type"];
  title: string;
  message: string;
  data?: Record<string, unknown>;
  sendEmail?: boolean;
  userEmail?: string;
}): Promise<INotification> {
  const notification = await Notification.create({
    userId: input.userId,
    companyId: input.companyId,
    type: input.type,
    title: input.title,
    message: input.message,
    data: input.data,
  });

  if (input.sendEmail && input.userEmail) {
    void sendEmailNotification(input.userEmail, {
      title: input.title,
      message: input.message,
    });
  }

  return notification;
}

export async function getUserNotifications(
  userId: Types.ObjectId | string,
  page: number,
  limit: number
) {
  const skip = (page - 1) * limit;
  const query = { userId };

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ ...query, isRead: false }),
  ]);

  return { items, total, unreadCount };
}

export async function markNotificationRead(
  userId: Types.ObjectId | string,
  notificationId: string
) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
}

export async function markAllNotificationsRead(userId: Types.ObjectId | string) {
  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
}

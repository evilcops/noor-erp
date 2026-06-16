import { logger } from "../utils/logger";

export async function sendEmailNotification(
  to: string,
  notification: { title: string; message: string }
): Promise<void> {
  // SMTP integration placeholder — logs in development
  logger.info("Email notification queued", {
    to,
    subject: notification.title,
    body: notification.message,
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
  });
}

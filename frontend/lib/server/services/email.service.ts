import nodemailer from "nodemailer";
import { AppError } from "../utils/AppError";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function mailEnv(key: string) {
  return process.env[key]?.trim().replace(/^["']|["']$/g, "");
}

function resolveFromName() {
  const raw = mailEnv("MAIL_FROM_NAME");
  if (!raw) return mailEnv("APP_NAME") || "NOOR ERP";
  return raw.replace(/\$\{APP_NAME\}/g, mailEnv("APP_NAME") || "NOOR ERP");
}

function getMailConfig() {
  const host = mailEnv("MAIL_HOST") || mailEnv("SMTP_HOST");
  const port = Number(mailEnv("MAIL_PORT") || mailEnv("SMTP_PORT") || 587);
  const encryption = (mailEnv("MAIL_ENCRYPTION") || "").toLowerCase();
  const secure =
    encryption === "ssl" ||
    encryption === "smtps" ||
    mailEnv("SMTP_SECURE") === "true" ||
    port === 465;

  const user =
    mailEnv("MAIL_USERNAME") ||
    mailEnv("MAIL_FROM_ADDRESS") ||
    mailEnv("SMTP_USER");

  const pass = mailEnv("MAIL_PASSWORD") || mailEnv("SMTP_PASS");

  const fromAddress = mailEnv("MAIL_FROM_ADDRESS") || user;
  const fromName = resolveFromName();
  const from =
    mailEnv("SMTP_FROM") ||
    (fromAddress ? `"${fromName}" <${fromAddress}>` : undefined) ||
    user ||
    "no-reply@noor-erp.local";

  return { host, port, secure, user, pass, from };
}

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const { host, port, secure, user, pass, from } = getMailConfig();

  if (!host) {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "Email is not configured. Set MAIL_HOST, MAIL_PORT, MAIL_PASSWORD, and MAIL_FROM_ADDRESS in .env",
      503
    );
  }

  if (!user || !pass) {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "Email auth is not configured. Set MAIL_FROM_ADDRESS and MAIL_PASSWORD in .env",
      503
    );
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({ from, to, subject, html, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    throw new AppError("BAD_REQUEST", message, 400);
  }
}

export async function sendEmailNotification(
  to: string,
  payload: { title: string; message: string }
) {
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;max-width:640px;">
      <h2 style="margin:0 0 12px;">${payload.title}</h2>
      <p style="margin:0;line-height:1.5;">${payload.message}</p>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px;">This message was sent from NOOR ERP.</p>
    </div>
  `;

  await sendEmail({
    to,
    subject: payload.title,
    html,
    text: `${payload.title}\n\n${payload.message}`,
  });
}

import mongoose from "mongoose";
import { Company } from "../models/Company.model";
import { User } from "../models/User.model";
import { comparePassword, hashPassword } from "./auth.service";
import { logger } from "../utils/logger";

/**
 * One-time data migrations that run at every startup (idempotent).
 * Uses raw MongoDB commands to bypass Mongoose schema validation so stale
 * enum values don't cause save errors.
 */
export async function runMigrations(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  // Rename legacy "pataka" document type → "bataka" in employees.documents[]
  const empResult = await db.collection("employees").updateMany(
    { "documents.type": "pataka" },
    { $set: { "documents.$[elem].type": "bataka" } },
    { arrayFilters: [{ "elem.type": "pataka" }] }
  );
  if (empResult.modifiedCount > 0) {
    logger.info(`Migration: renamed pataka→bataka in ${empResult.modifiedCount} employee document(s)`);
  }

  // Also fix complianceDocs embedded field if stored with old key name
  const empComp = await db.collection("employees").updateMany(
    { "complianceDocs.pataka": { $exists: true } },
    { $rename: { "complianceDocs.pataka": "complianceDocs.bataka" } }
  );
  if (empComp.modifiedCount > 0) {
    logger.info(`Migration: renamed complianceDocs.pataka→bataka in ${empComp.modifiedCount} employee(s)`);
  }
}

/**
 * In development, ensure the default admin account exists and the password works.
 * Also seeds a default company when the database is empty.
 */
export async function ensureDevAdmin(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  if (process.env.SKIP_DEV_ADMIN === "true") return;

  const email = (process.env.ADMIN_EMAIL ?? "admin@noor.om").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "Password123!";

  let user = await User.findOne({ email }).select("+password");

  if (user) {
    const valid = await comparePassword(password, user.password);
    if (!valid) {
      user.password = await hashPassword(password);
      await user.save();
      logger.info(`Dev admin password reset for ${email}`);
    }
  } else {
    user = await User.create({
      email,
      password: await hashPassword(password),
      firstName: "Super",
      lastName: "Admin",
      role: "super_admin",
      isActive: true,
    });
    logger.info(`Dev admin created — ${email} / ${password}`);
  }

  let company = await Company.findOne({});
  if (!company) {
    company = await Company.create({
      name: "NOOR Trading LLC",
      code: "NOOR01",
      email: "info@noor.om",
      phone: "+968 2412 3456",
      address: "Al Khuwair, Muscat",
      createdBy: user._id,
      updatedBy: user._id,
    });
    logger.info("Dev default company created — NOOR Trading LLC (NOOR01)");
  }

  // Ensure the admin user is linked to a company so controllers can use req.user.companyId
  if (!user.companyId && company) {
    user.companyId = company._id as typeof user.companyId;
    await user.save();
    logger.info(`Dev admin linked to company ${company.name}`);
  }
}

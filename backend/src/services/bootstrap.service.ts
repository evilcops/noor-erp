import { Company } from "../models/Company.model.js";
import { User } from "../models/User.model.js";
import { comparePassword, hashPassword } from "./auth.service.js";
import { logger } from "../utils/logger.js";

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

  const companyCount = await Company.countDocuments();
  if (companyCount === 0) {
    await Company.create({
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
}

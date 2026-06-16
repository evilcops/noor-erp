/**
 * Upsert the default super-admin user (does not wipe other data).
 * Usage: npm run reset-admin
 */
import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { User } from "../models/User.model";
const EMAIL = process.env.ADMIN_EMAIL ?? "admin@noor.om";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "Password123!";

async function resetAdmin() {
  await connectDatabase();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await User.findOneAndUpdate(
    { email: EMAIL.toLowerCase() },
    {
      $set: {
        email: EMAIL.toLowerCase(),
        password: passwordHash,
        firstName: "Super",
        lastName: "Admin",
        role: "super_admin",
        isActive: true,
      },
      $unset: { deletedAt: 1 },
    },
    { upsert: true, new: true }
  );

  console.log(`\nAdmin ready: ${user.email} / ${PASSWORD}\n`);
  await disconnectDatabase();
}

resetAdmin().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});

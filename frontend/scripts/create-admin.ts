/**
 * Create or update a Super Admin user.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts --email admin@noor.om --password "Password123!" --name "Super Admin"
 */
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const email = getArg("--email");
  const password = getArg("--password");
  const fullName = getArg("--name") || "Super Admin";

  if (!email || !password) {
    console.error(
      "Usage: npx tsx scripts/create-admin.ts --email <email> --password <password> [--name <name>]"
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash, fullName, role: UserRole.SUPER_ADMIN },
    create: {
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      role: UserRole.SUPER_ADMIN,
    },
  });

  console.log(`Super Admin ready: ${user.email} (${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

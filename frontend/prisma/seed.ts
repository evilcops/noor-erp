import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 12);

  const company = await prisma.company.upsert({
    where: { slug: "noor-demo" },
    update: {},
    create: {
      name: "NOOR Demo Company",
      slug: "noor-demo",
      email: "info@noor-demo.om",
      country: "OM",
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      companyId_code: { companyId: company.id, code: "HQ" },
    },
    update: {},
    create: {
      companyId: company.id,
      name: "Head Office",
      code: "HQ",
      city: "Muscat",
      address: "Al Khuwair, Muscat",
      latitude: 23.588,
      longitude: 58.3829,
      gpsRadiusM: 200,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@noor.om" },
    update: {},
    create: {
      email: "admin@noor.om",
      passwordHash,
      fullName: "Super Admin",
      role: UserRole.SUPER_ADMIN,
      companyId: company.id,
      branchId: branch.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "owner@noor.om" },
    update: {},
    create: {
      email: "owner@noor.om",
      passwordHash,
      fullName: "Business Owner",
      role: UserRole.BUSINESS_OWNER,
      companyId: company.id,
      branchId: branch.id,
    },
  });

  console.log("Seed complete.");
  console.log("  admin@noor.om  / Password123!  (Super Admin)");
  console.log("  owner@noor.om  / Password123!  (Business Owner)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

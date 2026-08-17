import { connectDatabase, disconnectDatabase } from "../config/database";
import { Branch } from "../models/Branch.model";
import { Company } from "../models/Company.model";
import { Product } from "../models/Product.model";
import { StockLevel } from "../models/StockLevel.model";

async function main() {
  await connectDatabase();
  const branches = await Branch.find({ deletedAt: null }).select("name code address companyId").lean();
  console.log(
    "BRANCHES",
    branches.map((b) => ({
      id: String(b._id),
      name: b.name,
      code: b.code,
      address: b.address,
      companyId: String(b.companyId),
    }))
  );
  const companies = await Company.find({ deletedAt: null }).select("name code").lean();
  console.log(
    "COMPANIES",
    companies.map((c) => ({ id: String(c._id), name: c.name, code: c.code }))
  );
  console.log("PRODUCTS", await Product.countDocuments({ deletedAt: null }));
  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

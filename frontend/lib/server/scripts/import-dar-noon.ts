/**
 * Imports the Dar Noon (instagram.com/darnoon) Omani silver catalogue as a
 * "Dar Noon" branch with one product per public Instagram post.
 * Safe to re-run: branch, products and stock rows are upserted.
 *
 * Instagram captions carry no prices, so sellingPrice/purchaseCost are left
 * empty and must be filled in from the ERP.
 */
import fs from "fs";
import path from "path";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { Branch } from "../models/Branch.model";
import { Company } from "../models/Company.model";
import { Product } from "../models/Product.model";
import { StockLevel } from "../models/StockLevel.model";

const IMAGE_DIR = path.join(__dirname, "data", "dar-noon");
const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

type Item = {
  post: string;
  name: string;
  subCategory: string;
  caption: string;
  postedAt: string;
};

const ITEMS: Item[] = [
  { post: "DcEJBbKCKIv", name: "Omani Silver Heritage Piece", subCategory: "Jewellery", postedAt: "2026-08-15",
    caption: "A little piece of heritage, made to become part of your story. Omani silver, crafted with details that never go out of style." },
  { post: "DcLq4tooLvY", name: "Omani Silver Jewellery Set", subCategory: "Jewellery", postedAt: "2026-08-18",
    caption: "Omani by heritage. Timeless by design." },
  { post: "DcVJIgciCFA", name: "Pure Omani Silver Collection", subCategory: "Jewellery", postedAt: "2026-08-21",
    caption: "Pure Omani silver that comes alive (فضة عمانيه خالصة تنبض بالحياة)." },
  { post: "DcVogLVISCV", name: "Omani Silver Ring & Bangle", subCategory: "Rings & Bangles", postedAt: "2026-08-22",
    caption: "Heritage lives in the details. Omani silver jewellery by Dar Noon, made to be noticed." },
  { post: "Dcf8vpNOA3k", name: "Luban Silver Accessory", subCategory: "Accessories", postedAt: "2026-08-25",
    caption: "Oman, in its most timeless details. Luban in the air, Dar Noon's silver worn with grace." },
  { post: "DcmQOKOorJ1", name: "Pomegranate Silver Jewellery", subCategory: "Jewellery", postedAt: "2026-08-28",
    caption: "A little silver against a little color. The kind of detail that catches your eye." },
  { post: "DcvFPRgoNcn", name: "Signature Silver Ring & Bangle", subCategory: "Rings & Bangles", postedAt: "2026-09-01",
    caption: "Wear the story. Make it yours. DAR NOON silver, made for a style that feels entirely your own." },
  { post: "Dc5pX2qIA7H", name: "Silver Heritage Urn", subCategory: "Home Decor", postedAt: "2026-09-05",
    caption: "A touch of silver, rooted in tradition. Timeless details made to be treasured." },
  { post: "DdBbDPsOl_a", name: "Traditional Silver Jewellery", subCategory: "Jewellery", postedAt: "2026-09-08",
    caption: "Every detail of tradition, reimagined in silver." },
  { post: "DdJZfqvIxHK", name: "Antique Silver Bangle", subCategory: "Rings & Bangles", postedAt: "2026-09-11",
    caption: "Silver pieces that tell stories of the past." },
  { post: "DdlyJUDolZo", name: "Silver Jewellery & Decor Vase", subCategory: "Home Decor", postedAt: "2026-09-22",
    caption: "A unique touch of silver. Omani jewellery by Dar Noon, where elegance meets craftsmanship." },
  { post: "DdvtsUco0vv", name: "Omani Heritage Silver Necklace", subCategory: "Necklaces", postedAt: "2026-09-26",
    caption: "Omani heritage in unforgettable details. Crafted with tradition, character, and timeless beauty." },
];

async function main() {
  await connectDatabase();

  const company = await Company.findOne({ deletedAt: null });
  if (!company) throw new Error("No company found — run `npm run seed` first.");

  const branch = await Branch.findOneAndUpdate(
    { companyId: company._id, code: "DARNOON" },
    {
      $set: { name: "Dar Noon", status: "active", deletedAt: null },
      $setOnInsert: {
        companyId: company._id,
        code: "DARNOON",
        address: "Oman — Omani silver artisan (instagram.com/darnoon)",
      },
    },
    { upsert: true, new: true }
  );
  console.log(`Branch: ${branch.name} (${branch._id})`);

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  for (const [i, item] of ITEMS.entries()) {
    const sku = `DN-${String(i + 1).padStart(3, "0")}`;
    const filename = `dar-noon-${item.post}.jpg`;
    fs.copyFileSync(path.join(IMAGE_DIR, `${item.post}.jpg`), path.join(UPLOAD_DIR, filename));

    const product = await Product.findOneAndUpdate(
      { companyId: company._id, sku },
      {
        $set: {
          name: item.name,
          code: sku,
          category: "Omani Silver",
          subCategory: item.subCategory,
          brand: "Dar Noon",
          description: item.caption,
          specifications: "925 sterling silver, made to order",
          unitOfMeasure: "pcs",
          images: [`/api/uploads/${filename}`],
          status: "active",
          notes: `Imported from https://www.instagram.com/darnoon/p/${item.post}/ (posted ${item.postedAt}). Price not listed on Instagram.`,
          deletedAt: null,
        },
        $setOnInsert: { companyId: company._id, sku },
      },
      { upsert: true, new: true }
    );

    await StockLevel.updateOne(
      { companyId: company._id, branchId: branch._id, productId: product._id },
      { $setOnInsert: { openingStock: 0, currentStock: 0 } },
      { upsert: true }
    );
    console.log(`  ${sku}  ${item.name}`);
  }

  console.log(`Imported ${ITEMS.length} Dar Noon products.`);
  await disconnectDatabase();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

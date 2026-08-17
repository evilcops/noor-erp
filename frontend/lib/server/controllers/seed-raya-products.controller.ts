import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Branch } from "../models/Branch.model";
import { Company } from "../models/Company.model";
import { Product } from "../models/Product.model";
import { StockLevel } from "../models/StockLevel.model";
import { resolveStoreCompanyId } from "../services/customer-auth.service";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

function assertDev() {
  if (process.env.NODE_ENV === "production") {
    throw new AppError("NOT_FOUND", "Not found", 404);
  }
}

type CatalogItem = {
  name: string;
  category: string;
  subCategory?: string;
  brand: string;
  unit: string;
  purchaseCost: number;
  sellingPrice: number;
  imageQuery: string;
};

function buildDescription(item: CatalogItem) {
  return [
    `${item.name} by ${item.brand}.`,
    `A quality pick from our ${item.category} range, stocked for fast delivery from the Raya branch.`,
    `Sold per ${item.unit}. Perfect for everyday shopping — check live availability on the storefront and add it to your cart in one tap.`,
  ].join(" ");
}

/** ~100 SKUs across 7 categories for Raya branch demos */
const CATALOG: CatalogItem[] = [
  // Dairy & Eggs (15)
  { name: "Fresh Full Cream Milk 1L", category: "Dairy & Eggs", brand: "Almarai", unit: "pcs", purchaseCost: 0.35, sellingPrice: 0.55, imageQuery: "milk-bottle" },
  { name: "Low Fat Milk 1L", category: "Dairy & Eggs", brand: "Almarai", unit: "pcs", purchaseCost: 0.32, sellingPrice: 0.5, imageQuery: "skim-milk" },
  { name: "Greek Yogurt 500g", category: "Dairy & Eggs", brand: "Activia", unit: "pcs", purchaseCost: 0.6, sellingPrice: 0.95, imageQuery: "yogurt" },
  { name: "Natural Yogurt Cup 150g", category: "Dairy & Eggs", brand: "Activia", unit: "pcs", purchaseCost: 0.18, sellingPrice: 0.3, imageQuery: "yogurt-cup" },
  { name: "Cheddar Cheese Block 400g", category: "Dairy & Eggs", brand: "Kraft", unit: "pcs", purchaseCost: 1.1, sellingPrice: 1.75, imageQuery: "cheddar-cheese" },
  { name: "Mozzarella Shredded 200g", category: "Dairy & Eggs", brand: "Puck", unit: "pcs", purchaseCost: 0.7, sellingPrice: 1.15, imageQuery: "mozzarella" },
  { name: "Cream Cheese Spread 200g", category: "Dairy & Eggs", brand: "Puck", unit: "pcs", purchaseCost: 0.55, sellingPrice: 0.9, imageQuery: "cream-cheese" },
  { name: "Salted Butter 200g", category: "Dairy & Eggs", brand: "Lurpak", unit: "pcs", purchaseCost: 0.8, sellingPrice: 1.25, imageQuery: "butter" },
  { name: "Unsalted Butter 200g", category: "Dairy & Eggs", brand: "Lurpak", unit: "pcs", purchaseCost: 0.82, sellingPrice: 1.28, imageQuery: "butter-block" },
  { name: "Farm Fresh Eggs 30pcs", category: "Dairy & Eggs", brand: "NOOR Farms", unit: "tray", purchaseCost: 1.4, sellingPrice: 2.1, imageQuery: "eggs-carton" },
  { name: "Free Range Eggs 12pcs", category: "Dairy & Eggs", brand: "NOOR Farms", unit: "pcs", purchaseCost: 0.75, sellingPrice: 1.2, imageQuery: "eggs" },
  { name: "Labneh 400g", category: "Dairy & Eggs", brand: "Puck", unit: "pcs", purchaseCost: 0.65, sellingPrice: 1.05, imageQuery: "labneh" },
  { name: "Cooking Cream 200ml", category: "Dairy & Eggs", brand: "Nestle", unit: "pcs", purchaseCost: 0.4, sellingPrice: 0.65, imageQuery: "cooking-cream" },
  { name: "Whipping Cream 250ml", category: "Dairy & Eggs", brand: "Nestle", unit: "pcs", purchaseCost: 0.5, sellingPrice: 0.8, imageQuery: "whipping-cream" },
  { name: "Flavored Milk Chocolate 200ml", category: "Dairy & Eggs", brand: "Nesquik", unit: "pcs", purchaseCost: 0.22, sellingPrice: 0.38, imageQuery: "chocolate-milk" },

  // Fresh Produce (15)
  { name: "Red Apples 1kg", category: "Fresh Produce", brand: "Fresh Pick", unit: "kg", purchaseCost: 0.7, sellingPrice: 1.15, imageQuery: "red-apples" },
  { name: "Bananas 1kg", category: "Fresh Produce", brand: "Fresh Pick", unit: "kg", purchaseCost: 0.35, sellingPrice: 0.6, imageQuery: "bananas" },
  { name: "Oranges 1kg", category: "Fresh Produce", brand: "Fresh Pick", unit: "kg", purchaseCost: 0.5, sellingPrice: 0.85, imageQuery: "oranges" },
  { name: "Lemons 500g", category: "Fresh Produce", brand: "Fresh Pick", unit: "pcs", purchaseCost: 0.3, sellingPrice: 0.55, imageQuery: "lemons" },
  { name: "Tomatoes 1kg", category: "Fresh Produce", brand: "Fresh Pick", unit: "kg", purchaseCost: 0.4, sellingPrice: 0.7, imageQuery: "tomatoes" },
  { name: "Cucumbers 1kg", category: "Fresh Produce", brand: "Fresh Pick", unit: "kg", purchaseCost: 0.35, sellingPrice: 0.6, imageQuery: "cucumbers" },
  { name: "Onions 1kg", category: "Fresh Produce", brand: "Fresh Pick", unit: "kg", purchaseCost: 0.25, sellingPrice: 0.45, imageQuery: "onions" },
  { name: "Potatoes 2kg", category: "Fresh Produce", brand: "Fresh Pick", unit: "bag", purchaseCost: 0.55, sellingPrice: 0.9, imageQuery: "potatoes" },
  { name: "Carrots 1kg", category: "Fresh Produce", brand: "Fresh Pick", unit: "kg", purchaseCost: 0.35, sellingPrice: 0.6, imageQuery: "carrots" },
  { name: "Lettuce Head", category: "Fresh Produce", brand: "Fresh Pick", unit: "pcs", purchaseCost: 0.28, sellingPrice: 0.48, imageQuery: "lettuce" },
  { name: "Spinach Bunch", category: "Fresh Produce", brand: "Fresh Pick", unit: "pcs", purchaseCost: 0.25, sellingPrice: 0.42, imageQuery: "spinach" },
  { name: "Garlic Pack 250g", category: "Fresh Produce", brand: "Fresh Pick", unit: "pcs", purchaseCost: 0.4, sellingPrice: 0.7, imageQuery: "garlic" },
  { name: "Ginger 250g", category: "Fresh Produce", brand: "Fresh Pick", unit: "pcs", purchaseCost: 0.35, sellingPrice: 0.6, imageQuery: "ginger" },
  { name: "Strawberries 250g", category: "Fresh Produce", brand: "Fresh Pick", unit: "pcs", purchaseCost: 0.9, sellingPrice: 1.45, imageQuery: "strawberries" },
  { name: "Grapes Green 500g", category: "Fresh Produce", brand: "Fresh Pick", unit: "pcs", purchaseCost: 0.85, sellingPrice: 1.35, imageQuery: "grapes" },

  // Bakery (12)
  { name: "White Sandwich Bread", category: "Bakery", brand: "Modern", unit: "pcs", purchaseCost: 0.35, sellingPrice: 0.55, imageQuery: "white-bread" },
  { name: "Brown Whole Wheat Bread", category: "Bakery", brand: "Modern", unit: "pcs", purchaseCost: 0.4, sellingPrice: 0.65, imageQuery: "brown-bread" },
  { name: "Arabic Pita Bread Pack", category: "Bakery", brand: "Local Bake", unit: "pcs", purchaseCost: 0.3, sellingPrice: 0.5, imageQuery: "pita-bread" },
  { name: "Croissants 4pcs", category: "Bakery", brand: "Local Bake", unit: "pcs", purchaseCost: 0.7, sellingPrice: 1.15, imageQuery: "croissants" },
  { name: "Dinner Rolls 6pcs", category: "Bakery", brand: "Local Bake", unit: "pcs", purchaseCost: 0.45, sellingPrice: 0.75, imageQuery: "dinner-rolls" },
  { name: "Chocolate Muffins 4pcs", category: "Bakery", brand: "Local Bake", unit: "pcs", purchaseCost: 0.8, sellingPrice: 1.3, imageQuery: "muffins" },
  { name: "Vanilla Cake Slice", category: "Bakery", brand: "Local Bake", unit: "pcs", purchaseCost: 0.5, sellingPrice: 0.85, imageQuery: "cake-slice" },
  { name: "Cookies Butter Pack 200g", category: "Bakery", brand: "McVitie's", unit: "pcs", purchaseCost: 0.55, sellingPrice: 0.9, imageQuery: "butter-cookies" },
  { name: "Digestive Biscuits 400g", category: "Bakery", brand: "McVitie's", unit: "pcs", purchaseCost: 0.7, sellingPrice: 1.1, imageQuery: "digestive-biscuits" },
  { name: "Flatbread Tortillas 8pcs", category: "Bakery", brand: "Mission", unit: "pcs", purchaseCost: 0.65, sellingPrice: 1.05, imageQuery: "tortillas" },
  { name: "Bagels Plain 4pcs", category: "Bakery", brand: "Local Bake", unit: "pcs", purchaseCost: 0.55, sellingPrice: 0.9, imageQuery: "bagels" },
  { name: "Donuts Assorted 6pcs", category: "Bakery", brand: "Local Bake", unit: "pcs", purchaseCost: 1.0, sellingPrice: 1.6, imageQuery: "donuts" },

  // Beverages (16)
  { name: "Mineral Water 1.5L", category: "Beverages", brand: "Masafi", unit: "pcs", purchaseCost: 0.15, sellingPrice: 0.28, imageQuery: "water-bottle" },
  { name: "Mineral Water 330ml 12pk", category: "Beverages", brand: "Masafi", unit: "pack", purchaseCost: 0.9, sellingPrice: 1.4, imageQuery: "water-pack" },
  { name: "Orange Juice 1L", category: "Beverages", brand: "Al Ain", unit: "pcs", purchaseCost: 0.55, sellingPrice: 0.9, imageQuery: "orange-juice" },
  { name: "Apple Juice 1L", category: "Beverages", brand: "Al Ain", unit: "pcs", purchaseCost: 0.55, sellingPrice: 0.9, imageQuery: "apple-juice" },
  { name: "Cola Soft Drink 330ml", category: "Beverages", brand: "Coca-Cola", unit: "pcs", purchaseCost: 0.2, sellingPrice: 0.35, imageQuery: "cola-can" },
  { name: "Cola Soft Drink 1.25L", category: "Beverages", brand: "Coca-Cola", unit: "pcs", purchaseCost: 0.4, sellingPrice: 0.7, imageQuery: "cola-bottle" },
  { name: "Lemon Soda 330ml", category: "Beverages", brand: "Sprite", unit: "pcs", purchaseCost: 0.2, sellingPrice: 0.35, imageQuery: "lemon-soda" },
  { name: "Energy Drink 250ml", category: "Beverages", brand: "Red Bull", unit: "pcs", purchaseCost: 0.7, sellingPrice: 1.15, imageQuery: "energy-drink" },
  { name: "Iced Tea Peach 500ml", category: "Beverages", brand: "Lipton", unit: "pcs", purchaseCost: 0.35, sellingPrice: 0.6, imageQuery: "iced-tea" },
  { name: "Green Tea Bags 25pcs", category: "Beverages", brand: "Lipton", unit: "pcs", purchaseCost: 0.8, sellingPrice: 1.3, imageQuery: "green-tea" },
  { name: "Black Tea 200g", category: "Beverages", brand: "Lipton", unit: "pcs", purchaseCost: 0.9, sellingPrice: 1.45, imageQuery: "black-tea" },
  { name: "Instant Coffee 100g", category: "Beverages", brand: "Nescafe", unit: "pcs", purchaseCost: 1.2, sellingPrice: 1.9, imageQuery: "instant-coffee" },
  { name: "Coffee Capsules 10pcs", category: "Beverages", brand: "Nespresso", unit: "pcs", purchaseCost: 2.0, sellingPrice: 3.2, imageQuery: "coffee-capsules" },
  { name: "Sparkling Water 500ml", category: "Beverages", brand: "Perrier", unit: "pcs", purchaseCost: 0.45, sellingPrice: 0.75, imageQuery: "sparkling-water" },
  { name: "Mango Nectar 1L", category: "Beverages", brand: "Al Ain", unit: "pcs", purchaseCost: 0.6, sellingPrice: 0.95, imageQuery: "mango-juice" },
  { name: "Sports Drink 500ml", category: "Beverages", brand: "Gatorade", unit: "pcs", purchaseCost: 0.5, sellingPrice: 0.85, imageQuery: "sports-drink" },

  // Snacks & Pantry (16)
  { name: "Potato Chips Classic 150g", category: "Snacks & Pantry", brand: "Lays", unit: "pcs", purchaseCost: 0.35, sellingPrice: 0.6, imageQuery: "potato-chips" },
  { name: "Potato Chips Salt & Vinegar 150g", category: "Snacks & Pantry", brand: "Lays", unit: "pcs", purchaseCost: 0.35, sellingPrice: 0.6, imageQuery: "chips-bag" },
  { name: "Tortilla Chips 180g", category: "Snacks & Pantry", brand: "Doritos", unit: "pcs", purchaseCost: 0.4, sellingPrice: 0.7, imageQuery: "tortilla-chips" },
  { name: "Mixed Nuts 250g", category: "Snacks & Pantry", brand: "NOOR", unit: "pcs", purchaseCost: 1.1, sellingPrice: 1.75, imageQuery: "mixed-nuts" },
  { name: "Dates Premium 500g", category: "Snacks & Pantry", brand: "NOOR", unit: "pcs", purchaseCost: 1.3, sellingPrice: 2.1, imageQuery: "dates" },
  { name: "Chocolate Bar Milk 90g", category: "Snacks & Pantry", brand: "Cadbury", unit: "pcs", purchaseCost: 0.45, sellingPrice: 0.75, imageQuery: "chocolate-bar" },
  { name: "Dark Chocolate 100g", category: "Snacks & Pantry", brand: "Lindt", unit: "pcs", purchaseCost: 0.9, sellingPrice: 1.45, imageQuery: "dark-chocolate" },
  { name: "Granola Bars 6pk", category: "Snacks & Pantry", brand: "Nature Valley", unit: "pcs", purchaseCost: 0.85, sellingPrice: 1.35, imageQuery: "granola-bars" },
  { name: "Basmati Rice 5kg", category: "Snacks & Pantry", brand: "India Gate", unit: "bag", purchaseCost: 3.5, sellingPrice: 5.2, imageQuery: "rice-bag" },
  { name: "Pasta Spaghetti 500g", category: "Snacks & Pantry", brand: "Barilla", unit: "pcs", purchaseCost: 0.5, sellingPrice: 0.85, imageQuery: "spaghetti" },
  { name: "Olive Oil Extra Virgin 750ml", category: "Snacks & Pantry", brand: "Bertolli", unit: "pcs", purchaseCost: 2.4, sellingPrice: 3.8, imageQuery: "olive-oil" },
  { name: "Sunflower Oil 1.5L", category: "Snacks & Pantry", brand: "Afia", unit: "pcs", purchaseCost: 1.2, sellingPrice: 1.9, imageQuery: "cooking-oil" },
  { name: "Tomato Paste 400g", category: "Snacks & Pantry", brand: "Del Monte", unit: "pcs", purchaseCost: 0.35, sellingPrice: 0.6, imageQuery: "tomato-paste" },
  { name: "Honey Pure 500g", category: "Snacks & Pantry", brand: "Langnese", unit: "pcs", purchaseCost: 1.5, sellingPrice: 2.4, imageQuery: "honey-jar" },
  { name: "Peanut Butter 340g", category: "Snacks & Pantry", brand: "Skippy", unit: "pcs", purchaseCost: 1.1, sellingPrice: 1.75, imageQuery: "peanut-butter" },
  { name: "Breakfast Cereal Corn Flakes 500g", category: "Snacks & Pantry", brand: "Kellogg's", unit: "pcs", purchaseCost: 1.0, sellingPrice: 1.6, imageQuery: "cereal-box" },

  // Household (14)
  { name: "Dishwashing Liquid 750ml", category: "Household", brand: "Fairy", unit: "pcs", purchaseCost: 0.7, sellingPrice: 1.15, imageQuery: "dish-soap" },
  { name: "Laundry Detergent 2kg", category: "Household", brand: "Ariel", unit: "pcs", purchaseCost: 2.2, sellingPrice: 3.5, imageQuery: "laundry-detergent" },
  { name: "Fabric Softener 2L", category: "Household", brand: "Downy", unit: "pcs", purchaseCost: 1.6, sellingPrice: 2.5, imageQuery: "fabric-softener" },
  { name: "All Purpose Cleaner 1L", category: "Household", brand: "Dettol", unit: "pcs", purchaseCost: 0.9, sellingPrice: 1.45, imageQuery: "cleaner-bottle" },
  { name: "Glass Cleaner 500ml", category: "Household", brand: "Ajax", unit: "pcs", purchaseCost: 0.55, sellingPrice: 0.9, imageQuery: "glass-cleaner" },
  { name: "Trash Bags Large 30pcs", category: "Household", brand: "Glad", unit: "pcs", purchaseCost: 0.85, sellingPrice: 1.35, imageQuery: "trash-bags" },
  { name: "Paper Towels 6 Rolls", category: "Household", brand: "Bounty", unit: "pack", purchaseCost: 1.4, sellingPrice: 2.2, imageQuery: "paper-towels" },
  { name: "Toilet Paper 12 Rolls", category: "Household", brand: "Charmin", unit: "pack", purchaseCost: 2.0, sellingPrice: 3.2, imageQuery: "toilet-paper" },
  { name: "Kitchen Sponges 6pcs", category: "Household", brand: "Scotch-Brite", unit: "pcs", purchaseCost: 0.4, sellingPrice: 0.7, imageQuery: "sponges" },
  { name: "Aluminum Foil 30m", category: "Household", brand: "Reynolds", unit: "pcs", purchaseCost: 0.9, sellingPrice: 1.45, imageQuery: "aluminum-foil" },
  { name: "Cling Film 30m", category: "Household", brand: "Glad", unit: "pcs", purchaseCost: 0.7, sellingPrice: 1.15, imageQuery: "cling-film" },
  { name: "Air Freshener Spray", category: "Household", brand: "Glade", unit: "pcs", purchaseCost: 0.8, sellingPrice: 1.3, imageQuery: "air-freshener" },
  { name: "Insect Killer Spray", category: "Household", brand: "Raid", unit: "pcs", purchaseCost: 1.1, sellingPrice: 1.75, imageQuery: "insect-spray" },
  { name: "LED Bulb 9W 2pk", category: "Household", brand: "Philips", unit: "pcs", purchaseCost: 1.0, sellingPrice: 1.6, imageQuery: "led-bulb" },

  // Personal Care (14)
  { name: "Shampoo Moisturizing 400ml", category: "Personal Care", brand: "Dove", unit: "pcs", purchaseCost: 1.1, sellingPrice: 1.75, imageQuery: "shampoo" },
  { name: "Conditioner Repair 400ml", category: "Personal Care", brand: "Dove", unit: "pcs", purchaseCost: 1.1, sellingPrice: 1.75, imageQuery: "conditioner" },
  { name: "Body Wash Fresh 500ml", category: "Personal Care", brand: "Dove", unit: "pcs", purchaseCost: 0.95, sellingPrice: 1.55, imageQuery: "body-wash" },
  { name: "Hand Soap Liquid 300ml", category: "Personal Care", brand: "Dettol", unit: "pcs", purchaseCost: 0.55, sellingPrice: 0.9, imageQuery: "hand-soap" },
  { name: "Toothpaste Fresh Mint 100ml", category: "Personal Care", brand: "Colgate", unit: "pcs", purchaseCost: 0.45, sellingPrice: 0.75, imageQuery: "toothpaste" },
  { name: "Toothbrush Soft 2pk", category: "Personal Care", brand: "Oral-B", unit: "pcs", purchaseCost: 0.7, sellingPrice: 1.15, imageQuery: "toothbrush" },
  { name: "Deodorant Stick Men", category: "Personal Care", brand: "Nivea", unit: "pcs", purchaseCost: 0.8, sellingPrice: 1.3, imageQuery: "deodorant" },
  { name: "Deodorant Spray Women", category: "Personal Care", brand: "Nivea", unit: "pcs", purchaseCost: 0.85, sellingPrice: 1.35, imageQuery: "deodorant-spray" },
  { name: "Facial Tissues 3 Ply", category: "Personal Care", brand: "Kleenex", unit: "pcs", purchaseCost: 0.5, sellingPrice: 0.85, imageQuery: "tissues" },
  { name: "Wet Wipes 80pcs", category: "Personal Care", brand: "Pampers", unit: "pcs", purchaseCost: 0.9, sellingPrice: 1.45, imageQuery: "wet-wipes" },
  { name: "Razors Disposable 5pk", category: "Personal Care", brand: "Gillette", unit: "pcs", purchaseCost: 1.2, sellingPrice: 1.9, imageQuery: "razors" },
  { name: "Cotton Pads 100pcs", category: "Personal Care", brand: "NOOR Care", unit: "pcs", purchaseCost: 0.4, sellingPrice: 0.7, imageQuery: "cotton-pads" },
  { name: "Hand Sanitizer 250ml", category: "Personal Care", brand: "Dettol", unit: "pcs", purchaseCost: 0.65, sellingPrice: 1.05, imageQuery: "hand-sanitizer" },
  { name: "Sunscreen SPF50 100ml", category: "Personal Care", brand: "Nivea", unit: "pcs", purchaseCost: 1.8, sellingPrice: 2.9, imageQuery: "sunscreen" },
];

function imageUrl(seed: string) {
  // Stable placeholder photos (works without auth; seed keeps each product unique)
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/640/480`;
}

function slugCode(name: string, index: number) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18);
  return `RAYA-${base}-${String(index + 1).padStart(3, "0")}`;
}

async function ensureRayaBranch(companyId: string) {
  const existing = await Branch.findOne({
    companyId,
    deletedAt: null,
    $or: [
      { name: /raya/i },
      { code: /raya/i },
      { address: /raya/i },
    ],
  });
  if (existing) return existing;

  return Branch.create({
    companyId,
    name: "Raya Lahore",
    code: "RAYA-LHR",
    address: "Raya, Lahore, Pakistan",
    gpsCoordinates: { lat: 31.4804642, lng: 74.3239342 },
    deliveryRadiusKm: 12,
    deliveryClusterCount: 6,
    status: "active",
  });
}

export async function seedRayaProducts(req: Request, res: Response) {
  assertDev();

  const companyId = process.env.STORE_COMPANY_ID
    ? String(process.env.STORE_COMPANY_ID)
    : await resolveStoreCompanyId();

  const company = await Company.findById(companyId).select("_id name");
  if (!company) throw new AppError("NOT_FOUND", "Store company not found", 404);

  const branch = await ensureRayaBranch(companyId);
  const replace = String(req.query.replace ?? req.body?.replace ?? "") === "1";

  if (replace) {
    const existing = await Product.find({
      companyId,
      sku: { $regex: /^RAYA-/ },
      deletedAt: null,
    }).select("_id");
    const ids = existing.map((p) => p._id);
    if (ids.length) {
      await StockLevel.deleteMany({ companyId, productId: { $in: ids } });
      await Product.updateMany({ _id: { $in: ids } }, { $set: { deletedAt: new Date(), status: "archived" } });
    }
  }

  let created = 0;
  let stocked = 0;
  let skipped = 0;
  const byCategory: Record<string, number> = {};

  for (let i = 0; i < CATALOG.length; i++) {
    const item = CATALOG[i];
    const sku = slugCode(item.name, i);
    const code = `RY-${String(i + 1).padStart(4, "0")}`;

    let product = await Product.findOne({ companyId, sku, deletedAt: null });
    const description = buildDescription(item);
    if (!product) {
      product = await Product.create({
        companyId,
        name: item.name,
        code,
        sku,
        category: item.category,
        subCategory: item.subCategory,
        brand: item.brand,
        description,
        purchaseCost: item.purchaseCost,
        sellingPrice: item.sellingPrice,
        unitOfMeasure: item.unit,
        minStockLevel: 10,
        reorderLevel: 20,
        images: [imageUrl(`raya-${sku}-${item.imageQuery}`)],
        status: "active",
      });
      created += 1;
    } else {
      skipped += 1;
      product.description = description;
      product.brand = item.brand;
      product.category = item.category;
      if (!product.images?.length) {
        product.images = [imageUrl(`raya-${sku}-${item.imageQuery}`)];
      }
      await product.save();
    }

    const qty = 40 + ((i * 7) % 80);
    const stock = await StockLevel.findOneAndUpdate(
      { companyId, branchId: branch._id, productId: product._id },
      {
        $set: {
          currentStock: qty,
          openingStock: qty,
          damagedStock: 0,
          returnedStock: 0,
          minStockLevel: 10,
          reorderLevel: 20,
        },
        $setOnInsert: {
          companyId,
          branchId: branch._id,
          productId: product._id,
        },
      },
      { upsert: true, new: true }
    );
    if (stock) stocked += 1;
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }

  return sendSuccess(res, {
    company: { id: String(company._id), name: company.name },
    branch: {
      id: String(branch._id),
      name: branch.name,
      code: branch.code,
      address: branch.address,
    },
    catalogSize: CATALOG.length,
    created,
    skippedExisting: skipped,
    stockRows: stocked,
    categories: byCategory,
  });
}

import { apiRoute } from "@/lib/server/next/createApiRoute";
import { seedRayaProducts } from "@/lib/server/controllers/seed-raya-products.controller";

export const POST = apiRoute({
  controller: seedRayaProducts,
  auth: false,
  apiPath: "/dev/seed-raya-products",
});

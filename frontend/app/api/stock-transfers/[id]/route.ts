import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as transferController from "@/lib/server/controllers/stock-transfer.controller";

export const GET = apiRoute({
  controller: transferController.getTransfer,
  auth: true,
  permission: { resource: "stock_transfer", action: "view" },
  audit: "stock_transfer",
  apiPath: "/stock-transfers/:id",
});

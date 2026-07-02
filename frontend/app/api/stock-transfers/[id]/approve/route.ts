import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as transferController from "@/lib/server/controllers/stock-transfer.controller";

export const POST = apiRoute({
  controller: transferController.approveTransfer,
  auth: true,
  permission: { resource: "stock_transfer", action: "approve" },
  audit: "stock_transfer",
  apiPath: "/stock-transfers/:id/approve",
});

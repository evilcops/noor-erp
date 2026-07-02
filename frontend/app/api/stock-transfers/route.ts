import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as transferController from "@/lib/server/controllers/stock-transfer.controller";
import { createStockTransferSchema } from "@/lib/server/schemas/stock-transfer.schema";

export const { GET, POST } = apiRoutes({
  GET: {
    controller: transferController.listTransfers,
    auth: true,
    permission: { resource: "stock_transfer", action: "view" },
    audit: "stock_transfer",
    apiPath: "/stock-transfers",
  },
  POST: {
    controller: transferController.createTransfer,
    auth: true,
    permission: { resource: "stock_transfer", action: "create" },
    validate: { schema: createStockTransferSchema },
    audit: "stock_transfer",
    apiPath: "/stock-transfers",
  },
});

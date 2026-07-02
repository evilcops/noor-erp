import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as transferController from "@/lib/server/controllers/stock-transfer.controller";
import { dispatchTransferSchema } from "@/lib/server/schemas/stock-transfer.schema";

export const POST = apiRoute({
  controller: transferController.dispatchTransfer,
  auth: true,
  permission: { resource: "stock_transfer", action: "edit" },
  validate: { schema: dispatchTransferSchema },
  audit: "stock_transfer",
  apiPath: "/stock-transfers/:id/dispatch",
});

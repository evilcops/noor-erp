import { apiRoute } from "@/lib/server/next/createApiRoute";
import * as dispatchController from "@/lib/server/controllers/dispatch-engine.controller";
import { z } from "zod";

const schema = z.object({
  companyId: z.string().min(1),
  branchId: z.string().min(1),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  totalAmount: z.number().min(0),
  quantity: z.number().min(1),
  preparationMinutes: z.number().min(0).optional(),
});

export const POST = apiRoute({
  controller: dispatchController.predictPromise,
  auth: true,
  permission: { resource: "delivery", action: "create" },
  validate: { schema },
  apiPath: "/deliveries/predict-promise",
});

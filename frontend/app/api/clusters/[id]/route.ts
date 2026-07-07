import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as clusterController from "@/lib/server/controllers/cluster.controller";
import { z } from "zod";

const updateClusterFields = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  center: z.object({ lat: z.number(), lng: z.number() }),
  shape: z.enum(["circle", "square", "sector"]),
  radiusKm: z.number().min(0.5).max(50),
  cellSizeKm: z.number().min(0.5).max(20),
  mainRadiusKm: z.number().min(1).max(100),
  origin: z.object({ lat: z.number(), lng: z.number() }),
  sectorStartDeg: z.number().min(0).max(360),
  sectorEndDeg: z.number().min(0).max(360),
  description: z.string(),
  status: z.enum(["active", "inactive"]),
});

const updateClusterSchema = updateClusterFields.partial();

export const { PATCH } = apiRoutes({
  PATCH: {
    controller: clusterController.updateCluster,
    auth: true,
    permission: { resource: "delivery", action: "edit" },
    validate: { schema: updateClusterSchema },
    apiPath: "/clusters/:id",
  },
});

import { apiRoutes } from "@/lib/server/next/createApiRoute";
import * as clusterController from "@/lib/server/controllers/cluster.controller";
import { z } from "zod";

const clusterSectorSlotSchema = z.object({
  companyId: z.string().min(1),
  branchId: z.string().min(1),
  sectorCount: z.number().min(2).max(24),
  sectorIndex: z.number().min(0).max(23),
  status: z.enum(["active", "inactive"]).optional(),
});

const clusterManualSchema = z
  .object({
    companyId: z.string().min(1),
    branchId: z.string().min(1),
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
    sectorCount: z.number().min(2).max(24),
    description: z.string(),
    status: z.enum(["active", "inactive"]),
  })
  .partial({
    shape: true,
    radiusKm: true,
    cellSizeKm: true,
    mainRadiusKm: true,
    origin: true,
    sectorStartDeg: true,
    sectorEndDeg: true,
    sectorCount: true,
    description: true,
    status: true,
  });

const clusterSchema = z.union([clusterSectorSlotSchema, clusterManualSchema]);

export const { GET, POST } = apiRoutes({
  GET: {
    controller: clusterController.listClusters,
    auth: true,
    permission: { resource: "delivery", action: "view" },
    apiPath: "/clusters",
  },
  POST: {
    controller: clusterController.createCluster,
    auth: true,
    permission: { resource: "delivery", action: "create" },
    validate: { schema: clusterSchema },
    apiPath: "/clusters",
  },
});

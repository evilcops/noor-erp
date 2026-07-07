import type { Request, Response } from "express";
import { Branch } from "../models/Branch.model";
import { DeliveryCluster } from "../models/DeliveryCluster.model";
import {
  DEFAULT_CLUSTER_SECTOR_COUNT,
  MAX_CLUSTER_SECTOR_COUNT,
  MIN_CLUSTER_SECTOR_COUNT,
  planSectorClusterForIndex,
  resolveBranchWarehouseCenter,
  sectorLabelForIndex,
} from "../services/cluster-grid.service";
import { assertCompanyAccess, buildTenantFilter } from "../services/permission.service";
import { buildMeta, buildSortQuery, parsePagination, sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

function clampSectorCount(count: number): number {
  return Math.min(MAX_CLUSTER_SECTOR_COUNT, Math.max(MIN_CLUSTER_SECTOR_COUNT, Math.round(count)));
}

export async function listClusters(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };
  if (req.query.branchId) filter.branchId = req.query.branchId;

  const [items, total] = await Promise.all([
    DeliveryCluster.find(filter)
      .sort(buildSortQuery(sortBy ?? "code", sortOrder ?? "asc"))
      .skip(skip)
      .limit(limit)
      .lean(),
    DeliveryCluster.countDocuments(filter),
  ]);

  return sendSuccess(res, items, 200, buildMeta(page, limit, total));
}

export async function createCluster(req: Request, res: Response) {
  assertCompanyAccess(req.user!, req.body.companyId);

  if (req.body.sectorIndex != null && req.body.sectorCount != null) {
    return createClusterFromSectorSlot(req, res);
  }

  const cluster = await DeliveryCluster.create({
    ...req.body,
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });

  return sendSuccess(res, cluster, 201);
}

async function createClusterFromSectorSlot(req: Request, res: Response) {
  const { companyId, branchId, sectorCount: rawCount, sectorIndex: rawIndex, status } = req.body as {
    companyId: string;
    branchId: string;
    sectorCount: number;
    sectorIndex: number;
    status?: "active" | "inactive";
  };

  const sectorCount = clampSectorCount(rawCount);
  const sectorIndex = Math.min(Math.max(Math.round(rawIndex), 0), sectorCount - 1);

  const branch = await Branch.findOne({
    _id: branchId,
    companyId,
    deletedAt: null,
    parentBranchId: null,
  });
  if (!branch) {
    throw new AppError("BAD_REQUEST", "Select a valid main branch with a warehouse location", 400);
  }

  const warehouse = await resolveBranchWarehouseCenter(branch);
  if (!branch.gpsCoordinates?.lat) {
    branch.gpsCoordinates = warehouse;
  }

  const previousCount = branch.deliveryClusterCount ?? DEFAULT_CLUSTER_SECTOR_COUNT;
  const countChanged = sectorCount !== previousCount;

  if (countChanged) {
    await DeliveryCluster.deleteMany({ branchId: branch._id });
    branch.deliveryClusterCount = sectorCount;
    await branch.save();
  } else if (branch.deliveryClusterCount == null) {
    branch.deliveryClusterCount = sectorCount;
    await branch.save();
  }

  const cell = planSectorClusterForIndex(warehouse, sectorIndex, {
    branchCode: branch.code,
    branchName: branch.name,
    sectorCount,
  });

  const existing = await DeliveryCluster.findOne({
    branchId: branch._id,
    deletedAt: null,
    sectorStartDeg: cell.sectorStartDeg,
    sectorEndDeg: cell.sectorEndDeg,
  });
  if (existing) {
    throw new AppError(
      "BAD_REQUEST",
      `${sectorLabelForIndex(sectorIndex, sectorCount)} already has a cluster for this branch`,
      400
    );
  }

  const codeTaken = await DeliveryCluster.findOne({
    companyId,
    code: cell.code,
    deletedAt: null,
  });
  if (codeTaken) {
    throw new AppError("BAD_REQUEST", `Cluster code ${cell.code} is already in use`, 400);
  }

  const cluster = await DeliveryCluster.create({
    companyId,
    branchId: branch._id,
    code: cell.code,
    name: cell.name,
    center: cell.center,
    origin: warehouse,
    shape: cell.shape,
    cellSizeKm: cell.cellSizeKm || undefined,
    mainRadiusKm: cell.mainRadiusKm,
    radiusKm: cell.radiusKm,
    sectorStartDeg: cell.sectorStartDeg,
    sectorEndDeg: cell.sectorEndDeg,
    sectorCount,
    description: cell.description,
    status: status ?? "active",
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });

  return sendSuccess(
    res,
    {
      ...cluster.toObject(),
      gridRepartitioned: countChanged,
      sectorCount,
    },
    201
  );
}

export async function updateCluster(req: Request, res: Response) {
  const tenant = buildTenantFilter(req.user!);
  const cluster = await DeliveryCluster.findOne({ _id: req.params.id, ...tenant, deletedAt: null });
  if (!cluster) throw new AppError("NOT_FOUND", "Cluster not found", 404);

  const { status, description } = req.body as { status?: string; description?: string };
  if (cluster.shape === "sector") {
    if (status) cluster.status = status as typeof cluster.status;
    if (description !== undefined) cluster.description = description;
    cluster.updatedBy = req.user!._id;
    await cluster.save();
    return sendSuccess(res, cluster);
  }

  Object.assign(cluster, req.body, { updatedBy: req.user!._id });
  await cluster.save();

  return sendSuccess(res, cluster);
}

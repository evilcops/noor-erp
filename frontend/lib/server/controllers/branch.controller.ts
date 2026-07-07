import type { Request, Response } from "express";
import mongoose from "mongoose";
import type { DeliveryExpandedRegion } from "@/lib/compass-directions";
import { Branch } from "../models/Branch.model";
import { BranchDocument } from "../models/BranchDocument.model";
import { DeliveryCluster } from "../models/DeliveryCluster.model";
import {
  assertBranchAccess,
  assertCompanyAccess,
  buildTenantFilter,
} from "../services/permission.service";
import {
  createDefaultClustersForBranch,
  regenerateClustersForBranch,
  resolveBranchWarehouseCenter,
} from "../services/cluster-grid.service";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

function normalizeBranchDeliveryRegions<T extends Record<string, unknown>>(branch: T) {
  const regions = Array.isArray(branch.deliveryExpandedRegions)
    ? (branch.deliveryExpandedRegions as DeliveryExpandedRegion[])
    : [];
  const legacy = branch.deliveryExpandedRegion as DeliveryExpandedRegion | undefined;
  const deliveryExpandedRegions =
    regions.length > 0
      ? regions
      : legacy?.fromDirection && legacy?.toDirection
        ? [legacy]
        : [];
  return { ...branch, deliveryExpandedRegions };
}

async function validateParentBranch(
  companyId: string,
  parentBranchId?: string | null
) {
  if (!parentBranchId) return null;

  const parent = await Branch.findOne({
    _id: parentBranchId,
    companyId,
    deletedAt: null,
  });

  if (!parent) {
    throw new AppError("BAD_REQUEST", "Parent branch not found", 400);
  }

  if (parent.parentBranchId) {
    throw new AppError(
      "BAD_REQUEST",
      "Sub-branches cannot have their own sub-branches. Select a main branch as parent.",
      400
    );
  }

  return parent;
}

async function permanentlyDeleteBranchTree(branch: {
  _id: mongoose.Types.ObjectId;
  parentBranchId?: mongoose.Types.ObjectId | null;
}) {
  const branchId = branch._id;

  if (!branch.parentBranchId) {
    await DeliveryCluster.collection.deleteMany({ branchId });
    const subBranchIds = await Branch.collection.distinct("_id", { parentBranchId: branchId });
    if (subBranchIds.length > 0) {
      await BranchDocument.collection.deleteMany({ branchId: { $in: subBranchIds } });
      await Branch.collection.deleteMany({ _id: { $in: subBranchIds } });
    }
  }

  await BranchDocument.collection.deleteMany({ branchId });
  await Branch.collection.deleteOne({ _id: branchId });
}

async function removeArchivedBranchWithCode(companyId: string, code: string) {
  const archived = await Branch.findOne({
    companyId,
    code: code.toUpperCase(),
    deletedAt: { $ne: null },
  });
  if (archived) {
    await permanentlyDeleteBranchTree(archived);
  }
}

export async function createBranch(req: Request, res: Response) {
  assertCompanyAccess(req.user!, req.body.companyId);
  await validateParentBranch(req.body.companyId, req.body.parentBranchId ?? null);

  const code = String(req.body.code).toUpperCase();
  await removeArchivedBranchWithCode(req.body.companyId, code);

  const branch = await Branch.create({
    ...req.body,
    parentBranchId: req.body.parentBranchId || null,
    code,
    createdBy: req.user!._id,
    updatedBy: req.user!._id,
  });

  let autoClusters: unknown[] = [];
  if (!branch.parentBranchId) {
    const warehouse = await resolveBranchWarehouseCenter(branch);
    if (!branch.gpsCoordinates?.lat) {
      branch.gpsCoordinates = warehouse;
      await branch.save();
    }
    autoClusters = await createDefaultClustersForBranch({
      companyId: branch.companyId,
      branchId: branch._id,
      branchCode: branch.code,
      branchName: branch.name,
      warehouse,
      userId: req.user!._id,
      sectorCount: branch.deliveryClusterCount,
      mainRadiusKm: branch.deliveryRadiusKm,
    });
  }

  const populated = await Branch.findById(branch._id)
    .populate("parentBranchId", "name code")
    .lean();

  return sendSuccess(
    res,
    {
      ...populated,
      clustersCreated: autoClusters.length,
      clusters: autoClusters,
    },
    201
  );
}

export async function listBranches(req: Request, res: Response) {
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { ...buildTenantFilter(req.user!), deletedAt: null };
  if (req.query.companyId) filter.companyId = req.query.companyId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.parentBranchId) {
    filter.parentBranchId =
      req.query.parentBranchId === "null" ? null : req.query.parentBranchId;
  }
  if (req.query.type === "main") filter.parentBranchId = null;
  if (req.query.type === "sub") filter.parentBranchId = { $ne: null };
  if (req.query.search) {
    filter.$or = [
      { name: new RegExp(String(req.query.search), "i") },
      { code: new RegExp(String(req.query.search), "i") },
    ];
  }

  const [items, total] = await Promise.all([
    Branch.find(filter)
      .sort(buildSortQuery(sortBy, sortOrder))
      .skip(skip)
      .limit(limit)
      .populate("parentBranchId", "name code")
      .lean(),
    Branch.countDocuments(filter),
  ]);

  const ids = items.map((b) => b._id);
  const subCounts = await Branch.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { parentBranchId: { $in: ids }, deletedAt: null } },
    { $group: { _id: "$parentBranchId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(subCounts.map((s) => [String(s._id), s.count]));

  const enriched = items.map((b) =>
    normalizeBranchDeliveryRegions({
      ...b,
      subBranchCount: countMap.get(String(b._id)) ?? 0,
    })
  );

  return sendSuccess(res, enriched, 200, buildMeta(page, limit, total));
}

export async function getBranch(req: Request, res: Response) {
  const branch = await Branch.findById(req.params.id)
    .populate("parentBranchId", "name code")
    .lean();
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);
  assertBranchAccess(req.user!, branch._id, branch.companyId);

  const subBranches = await Branch.find({
    parentBranchId: branch._id,
    deletedAt: null,
  })
    .select("name code status address")
    .sort({ name: 1 })
    .lean();

  return sendSuccess(res, normalizeBranchDeliveryRegions({ ...branch, subBranches }));
}

export async function updateBranch(req: Request, res: Response) {
  const branch = await Branch.findById(req.params.id);
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);
  assertBranchAccess(req.user!, branch._id, branch.companyId);

  if (req.body.parentBranchId !== undefined) {
    if (String(req.body.parentBranchId) === String(branch._id)) {
      throw new AppError("BAD_REQUEST", "A branch cannot be its own parent", 400);
    }
    await validateParentBranch(String(branch.companyId), req.body.parentBranchId);
  }

  req.auditMeta = {
    entityType: "branch",
    oldValue: branch.toObject() as unknown as Record<string, unknown>,
  };

  const isMain = !branch.parentBranchId;
  const prevClusterCount = branch.deliveryClusterCount;
  const prevRadiusKm = branch.deliveryRadiusKm;

  Object.assign(branch, req.body, { updatedBy: req.user!._id });
  await branch.save();

  if (
    isMain &&
    ((req.body.deliveryClusterCount !== undefined &&
      req.body.deliveryClusterCount !== prevClusterCount) ||
      (req.body.deliveryRadiusKm !== undefined && req.body.deliveryRadiusKm !== prevRadiusKm))
  ) {
    await regenerateClustersForBranch(branch._id.toString(), req.user!._id, {
      sectorCount: branch.deliveryClusterCount,
      mainRadiusKm: branch.deliveryRadiusKm,
    });
  }

  const populated = await Branch.findById(branch._id)
    .populate("parentBranchId", "name code")
    .lean();

  return sendSuccess(res, populated);
}

export async function deleteBranch(req: Request, res: Response) {
  const branch = await Branch.findById(req.params.id);
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);
  assertBranchAccess(req.user!, branch._id, branch.companyId);

  await permanentlyDeleteBranchTree(branch);
  return sendSuccess(res, { message: "Branch deleted" });
}

export async function addBranchHoliday(req: Request, res: Response) {
  const branch = await Branch.findById(req.params.id);
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);
  assertBranchAccess(req.user!, branch._id, branch.companyId);

  branch.holidays.push({
    name: req.body.name,
    date: new Date(req.body.date),
    isRecurring: req.body.isRecurring ?? false,
  });
  await branch.save();
  return sendSuccess(res, branch);
}

export async function regenerateBranchClusters(req: Request, res: Response) {
  const branch = await Branch.findOne({ _id: req.params.id, deletedAt: null });
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);
  assertBranchAccess(req.user!, branch._id, branch.companyId);

  if (branch.parentBranchId) {
    throw new AppError(
      "BAD_REQUEST",
      "Only main branches have delivery zone grids. Select the main branch.",
      400
    );
  }

  const sectorCount =
    typeof req.body?.sectorCount === "number" ? req.body.sectorCount : undefined;
  const deliveryRadiusKm =
    typeof req.body?.deliveryRadiusKm === "number" ? req.body.deliveryRadiusKm : undefined;

  let expandedRegions: DeliveryExpandedRegion[] | null | undefined;
  if (req.body?.expandedRegions === null) {
    expandedRegions = null;
  } else if (Array.isArray(req.body?.expandedRegions)) {
    expandedRegions = req.body.expandedRegions
      .filter((r: unknown) => r && typeof r === "object")
      .map((r: Record<string, unknown>) => ({
        fromDirection: String(r.fromDirection) as DeliveryExpandedRegion["fromDirection"],
        toDirection: String(r.toDirection) as DeliveryExpandedRegion["toDirection"],
        radiusKm: Number(r.radiusKm),
        clusterCount: Number(r.clusterCount),
      }));
  } else if (req.body?.expandedRegion === null) {
    expandedRegions = null;
  } else if (
    req.body?.expandedRegion &&
    typeof req.body.expandedRegion === "object" &&
    req.body.expandedRegion.fromDirection &&
    req.body.expandedRegion.toDirection
  ) {
    expandedRegions = [
      {
        fromDirection: String(req.body.expandedRegion.fromDirection) as DeliveryExpandedRegion["fromDirection"],
        toDirection: String(req.body.expandedRegion.toDirection) as DeliveryExpandedRegion["toDirection"],
        radiusKm: Number(req.body.expandedRegion.radiusKm),
        clusterCount: Number(req.body.expandedRegion.clusterCount),
      },
    ];
  }

  const clusters = await regenerateClustersForBranch(branch._id.toString(), req.user!._id, {
    sectorCount,
    mainRadiusKm: deliveryRadiusKm,
    ...(expandedRegions !== undefined ? { expandedRegions } : {}),
  });
  const updated = await Branch.findById(branch._id).lean();
  const normalized = updated ? normalizeBranchDeliveryRegions(updated as Record<string, unknown>) : null;
  return sendSuccess(
    res,
    {
      count: clusters.length,
      clusters,
      sectorCount: normalized?.deliveryClusterCount ?? sectorCount,
      deliveryRadiusKm: normalized?.deliveryRadiusKm ?? deliveryRadiusKm,
      deliveryExpandedRegions: normalized?.deliveryExpandedRegions ?? [],
    },
    201
  );
}

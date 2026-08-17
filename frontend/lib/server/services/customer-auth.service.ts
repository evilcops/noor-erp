import { normalizePhone } from "@/lib/phone";
import mongoose from "mongoose";
import {
  comparePassword,
  hashPassword,
  hashToken,
  signAccessToken,
  signRefreshToken,
} from "./auth.service";
import { getUserPermissions } from "./permission.service";
import { geocodeAddress } from "./geocoding.service";
import { distanceKm, resolveClusterForCompanyPoint } from "./cluster-grid.service";
import { User } from "../models/User.model";
import { Customer } from "../models/Customer.model";
import { Company } from "../models/Company.model";
import { Branch } from "../models/Branch.model";
import { DeliveryCluster } from "../models/DeliveryCluster.model";
import { AppError } from "../utils/AppError";

export type StoreBranchSummary = {
  _id: string;
  name: string;
  code: string;
  address?: string;
  deliveryRadiusKm: number;
  distanceKm?: number;
};

export async function resolveStoreCompanyId() {
  if (process.env.STORE_COMPANY_ID) return process.env.STORE_COMPANY_ID;
  const company = await Company.findOne({ deletedAt: null }).sort({ createdAt: 1 }).select("_id").lean();
  if (!company) throw new AppError("NOT_FOUND", "No store company configured", 404);
  return String(company._id);
}

export async function resolveStoreBranchId(companyId: string, preferredBranchId?: string | null) {
  if (preferredBranchId) {
    const branch = await Branch.findOne({
      _id: preferredBranchId,
      companyId,
      deletedAt: null,
    })
      .select("_id")
      .lean();
    if (branch) return String(branch._id);
  }

  const main = await Branch.findOne({
    companyId,
    deletedAt: null,
    $or: [{ parentBranchId: null }, { parentBranchId: { $exists: false } }],
  })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();

  if (!main) throw new AppError("BAD_REQUEST", "No store branch available", 400);
  return String(main._id);
}

function toBranchSummary(
  branch: {
    _id: unknown;
    name: string;
    code: string;
    address?: string;
    deliveryRadiusKm?: number;
    gpsCoordinates?: { lat?: number; lng?: number } | null;
  },
  distanceKmValue?: number
): StoreBranchSummary {
  return {
    _id: String(branch._id),
    name: branch.name,
    code: branch.code,
    address: branch.address,
    deliveryRadiusKm: branch.deliveryRadiusKm ?? 10,
    distanceKm: distanceKmValue,
  };
}

/**
 * Resolve serving branch from GPS.
 * If preferredBranchId is set, only that branch's clusters/radius count.
 */
export async function resolveNearestStoreBranch(
  companyId: string,
  coordinates: { lat: number; lng: number },
  preferredBranchId?: string | null
) {
  if (preferredBranchId) {
    const branch = await Branch.findOne({
      _id: preferredBranchId,
      companyId,
      deletedAt: null,
      status: "active",
    })
      .select("_id name code address deliveryRadiusKm gpsCoordinates")
      .lean();
    if (!branch) {
      throw new AppError("BAD_REQUEST", "Selected branch not found", 400);
    }

    const dist =
      branch.gpsCoordinates?.lat != null && branch.gpsCoordinates?.lng != null
        ? distanceKm(coordinates, branch.gpsCoordinates)
        : undefined;

    const cluster = await resolveClusterForCompanyPoint(companyId, coordinates, preferredBranchId);
    if (cluster) {
      return {
        inService: true,
        clusterId: String(cluster._id),
        distanceKm: dist,
        branch: toBranchSummary(branch, dist),
      };
    }

    const hasClusters = await DeliveryCluster.exists({
      companyId,
      branchId: preferredBranchId,
      status: "active",
      deletedAt: null,
    });

    if (hasClusters) {
      return {
        inService: false,
        clusterId: null as string | null,
        distanceKm: dist,
        branch: toBranchSummary(branch, dist),
      };
    }

    const radius = branch.deliveryRadiusKm ?? 10;
    const inRadius = dist != null && dist <= radius;
    return {
      inService: inRadius,
      clusterId: null as string | null,
      distanceKm: dist,
      branch: toBranchSummary(branch, dist),
    };
  }

  const cluster = await resolveClusterForCompanyPoint(companyId, coordinates);
  if (cluster?.branchId) {
    const branch = await Branch.findOne({
      _id: cluster.branchId,
      companyId,
      deletedAt: null,
      status: "active",
    })
      .select("_id name code address deliveryRadiusKm gpsCoordinates")
      .lean();
    if (branch) {
      const dist =
        branch.gpsCoordinates?.lat != null && branch.gpsCoordinates?.lng != null
          ? distanceKm(coordinates, branch.gpsCoordinates)
          : undefined;
      return {
        inService: true,
        clusterId: String(cluster._id),
        distanceKm: dist,
        branch: toBranchSummary(branch, dist),
      };
    }
  }

  const branches = await Branch.find({
    companyId,
    deletedAt: null,
    status: "active",
    $or: [{ parentBranchId: null }, { parentBranchId: { $exists: false } }],
  })
    .select("_id name code address deliveryRadiusKm gpsCoordinates")
    .lean();

  type Candidate = { branch: (typeof branches)[number]; distance: number };
  let nearestInRadius: Candidate | null = null;
  let nearestOverall: Candidate | null = null;

  for (const branch of branches) {
    if (branch.gpsCoordinates?.lat == null || branch.gpsCoordinates?.lng == null) continue;
    const distance = distanceKm(coordinates, branch.gpsCoordinates);
    if (!nearestOverall || distance < nearestOverall.distance) {
      nearestOverall = { branch, distance };
    }
    const radius = branch.deliveryRadiusKm ?? 10;
    if (distance <= radius && (!nearestInRadius || distance < nearestInRadius.distance)) {
      nearestInRadius = { branch, distance };
    }
  }

  const pick = nearestInRadius ?? nearestOverall;
  if (!pick) {
    throw new AppError("BAD_REQUEST", "No store branches are configured yet", 400);
  }

  return {
    inService: Boolean(nearestInRadius),
    clusterId: null as string | null,
    distanceKm: pick.distance,
    branch: toBranchSummary(pick.branch, pick.distance),
  };
}

async function resolveCustomerLocation(
  companyId: string,
  data: {
    address?: string;
    coordinates?: { lat: number; lng: number };
    branchId?: string | null;
  }
) {
  let coordinates = data.coordinates;
  try {
    if (!coordinates && data.address) {
      coordinates = (await geocodeAddress(data.address)) ?? undefined;
    }
    if (!coordinates) return { coordinates: undefined, clusterId: null, branchId: null, nearest: null };
    const nearest = await resolveNearestStoreBranch(companyId, coordinates, data.branchId);
    return {
      coordinates,
      clusterId: nearest.clusterId ? new mongoose.Types.ObjectId(nearest.clusterId) : null,
      branchId: nearest.inService ? nearest.branch._id : null,
      nearest,
    };
  } catch {
    return { coordinates, clusterId: null, branchId: null, nearest: null };
  }
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Customer", lastName: "User" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "Customer" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function registerStoreCustomer(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  address?: string;
  area?: string;
  coordinates?: { lat: number; lng: number };
  branchId?: string;
}) {
  const companyId = await resolveStoreCompanyId();
  const email = input.email.toLowerCase().trim();
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError("BAD_REQUEST", "A valid phone number is required", 400);
  if (input.password.length < 8) {
    throw new AppError("BAD_REQUEST", "Password must be at least 8 characters", 400);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) throw new AppError("CONFLICT", "Email already registered", 409);

  const existingCustomer = await Customer.findOne({ companyId, phone, deletedAt: null });
  if (existingCustomer?.userId) {
    throw new AppError("CONFLICT", "Phone already registered", 409);
  }

  const { firstName, lastName } = splitName(input.name);
  const location = await resolveCustomerLocation(companyId, {
    address: input.address,
    coordinates: input.coordinates,
    branchId: input.branchId,
  });

  const preferredBranchId = input.branchId || (location.branchId ? String(location.branchId) : null);
  if (input.coordinates && location.nearest && !location.nearest.inService) {
    throw new AppError(
      "OUT_OF_SERVICE",
      "We don't deliver in that area",
      400
    );
  }

  const branchId = await resolveStoreBranchId(companyId, preferredBranchId);
  let branchSummary: StoreBranchSummary | null = location.nearest?.branch ?? null;
  if (!branchSummary) {
    const branch = await Branch.findById(branchId).select("_id name code address deliveryRadiusKm").lean();
    if (branch) {
      branchSummary = {
        _id: String(branch._id),
        name: branch.name,
        code: branch.code,
        address: branch.address,
        deliveryRadiusKm: branch.deliveryRadiusKm ?? 10,
      };
    }
  }

  const user = await User.create({
    email,
    password: await hashPassword(input.password),
    firstName,
    lastName,
    phone,
    role: "customer",
    companyId,
    branchId,
  });

  let customer = existingCustomer;
  if (customer) {
    customer.userId = user._id;
    customer.email = email;
    customer.name = input.name.trim();
    if (input.address?.trim()) customer.address = input.address.trim();
    if (input.area?.trim()) customer.area = input.area.trim();
    if (location.coordinates) {
      customer.coordinates = location.coordinates;
      customer.clusterId = location.clusterId;
    }
    customer.branchId = branchId as unknown as typeof customer.branchId;
    customer.updatedBy = user._id;
    await customer.save();
  } else {
    customer = await Customer.create({
      companyId,
      phone,
      email,
      name: input.name.trim(),
      address: input.address?.trim() || undefined,
      area: input.area?.trim() || undefined,
      coordinates: location.coordinates,
      clusterId: location.clusterId,
      branchId,
      userId: user._id,
      createdBy: user._id,
      updatedBy: user._id,
    });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  return {
    user: {
      id: String(user._id),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      role: user.role,
      companyId: String(companyId),
      branchId: String(branchId),
      isActive: user.isActive,
      permissions: getUserPermissions(user),
    },
    customer: {
      _id: String(customer._id),
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      area: customer.area,
      coordinates: customer.coordinates,
      branchId: String(customer.branchId ?? branchId),
    },
    branch: branchSummary,
    accessToken,
    refreshToken,
  };
}

export async function updateStoreCustomerLocation(
  userId: string,
  input: {
    address?: string;
    area?: string;
    coordinates?: { lat: number; lng: number };
    branchId?: string;
  }
) {
  const user = await User.findOne({ _id: userId, role: "customer", isActive: true });
  if (!user) throw new AppError("NOT_FOUND", "Customer not found", 404);
  const companyId = user.companyId ? String(user.companyId) : await resolveStoreCompanyId();

  const customer = await Customer.findOne({ userId: user._id, deletedAt: null });
  if (!customer) throw new AppError("NOT_FOUND", "Customer profile not found", 404);

  if (!input.coordinates && !input.address?.trim()) {
    throw new AppError("BAD_REQUEST", "Pin your delivery location on the map", 400);
  }

  const location = await resolveCustomerLocation(companyId, {
    address: input.address,
    coordinates: input.coordinates,
    branchId: input.branchId,
  });

  if (!location.coordinates) {
    throw new AppError("BAD_REQUEST", "Pin your delivery location on the map", 400);
  }

  if (!location.nearest?.inService) {
    throw new AppError("OUT_OF_SERVICE", "We don't deliver in that area", 400);
  }

  const branchId = await resolveStoreBranchId(
    companyId,
    input.branchId || (location.branchId ? String(location.branchId) : null)
  );

  if (input.address?.trim()) customer.address = input.address.trim();
  if (input.area?.trim()) customer.area = input.area.trim();
  if (location.coordinates) {
    customer.coordinates = location.coordinates;
    customer.clusterId = location.clusterId;
  }
  customer.branchId = branchId as unknown as typeof customer.branchId;
  customer.updatedBy = user._id;
  await customer.save();

  user.branchId = branchId as unknown as typeof user.branchId;
  await user.save();

  let branchSummary: StoreBranchSummary | null = location.nearest?.branch ?? null;
  if (!branchSummary) {
    const branch = await Branch.findById(branchId).select("_id name code address deliveryRadiusKm").lean();
    if (branch) {
      branchSummary = {
        _id: String(branch._id),
        name: branch.name,
        code: branch.code,
        address: branch.address,
        deliveryRadiusKm: branch.deliveryRadiusKm ?? 10,
      };
    }
  }

  return {
    customer: {
      _id: String(customer._id),
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      area: customer.area,
      coordinates: customer.coordinates,
      branchId: String(branchId),
    },
    branch: branchSummary,
    inService: location.nearest?.inService ?? false,
  };
}

export async function loginStoreCustomer(email: string, password: string) {
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    role: "customer",
    isActive: true,
  }).select("+password +refreshTokenHash");

  if (!user) throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);

  const customer = await Customer.findOne({ userId: user._id, deletedAt: null }).lean();
  if (!customer) throw new AppError("NOT_FOUND", "Customer profile not found", 404);

  const branchId = customer.branchId ?? user.branchId;
  let branch: StoreBranchSummary | null = null;
  if (branchId) {
    const row = await Branch.findById(branchId).select("_id name code address deliveryRadiusKm").lean();
    if (row) {
      branch = {
        _id: String(row._id),
        name: row.name,
        code: row.code,
        address: row.address,
        deliveryRadiusKm: row.deliveryRadiusKm ?? 10,
      };
    }
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshTokenHash = hashToken(refreshToken);
  user.lastLogin = new Date();
  await user.save();

  return {
    user: {
      id: String(user._id),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      role: user.role,
      companyId: user.companyId ? String(user.companyId) : undefined,
      branchId: branchId ? String(branchId) : undefined,
      isActive: user.isActive,
      permissions: getUserPermissions(user),
    },
    customer: {
      _id: String(customer._id),
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      area: customer.area,
      coordinates: customer.coordinates,
      branchId: branchId ? String(branchId) : undefined,
    },
    branch,
    accessToken,
    refreshToken,
  };
}

export async function getStoreCustomerProfile(userId: string) {
  const user = await User.findOne({ _id: userId, role: "customer", isActive: true });
  if (!user) throw new AppError("NOT_FOUND", "Customer not found", 404);

  const customer = await Customer.findOne({ userId: user._id, deletedAt: null }).lean();
  if (!customer) throw new AppError("NOT_FOUND", "Customer profile not found", 404);

  const branchId = customer.branchId ?? user.branchId;
  let branch: StoreBranchSummary | null = null;
  if (branchId) {
    const row = await Branch.findById(branchId).select("_id name code address deliveryRadiusKm").lean();
    if (row) {
      branch = {
        _id: String(row._id),
        name: row.name,
        code: row.code,
        address: row.address,
        deliveryRadiusKm: row.deliveryRadiusKm ?? 10,
      };
    }
  }

  return {
    user: {
      id: String(user._id),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      role: user.role,
      companyId: user.companyId ? String(user.companyId) : undefined,
      branchId: branchId ? String(branchId) : undefined,
      isActive: user.isActive,
      permissions: getUserPermissions(user),
    },
    customer: {
      _id: String(customer._id),
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      area: customer.area,
      coordinates: customer.coordinates,
      branchId: branchId ? String(branchId) : undefined,
    },
    branch,
  };
}

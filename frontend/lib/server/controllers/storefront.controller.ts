import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Product } from "../models/Product.model";
import { StockLevel } from "../models/StockLevel.model";
import { Sale } from "../models/Sale.model";
import { Customer } from "../models/Customer.model";
import { Branch } from "../models/Branch.model";
import { Delivery } from "../models/Delivery.model";
import {
  getStoreCustomerProfile,
  loginStoreCustomer,
  registerStoreCustomer,
  resolveNearestStoreBranch,
  resolveStoreBranchId,
  resolveStoreCompanyId,
  updateStoreCustomerLocation,
} from "../services/customer-auth.service";
import { geocodeAddress } from "../services/geocoding.service";
import { createDeliveryFromSale } from "../services/delivery.service";
import {
  syncProductStockStatus,
  updateStockLevel,
} from "../services/inventory.service";
import { notifyLowStock } from "../services/inventory-notification.service";
import { logoutUser } from "../services/auth.service";
import {
  buildMeta,
  buildSortQuery,
  parsePagination,
  sendSuccess,
} from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

async function generateSaleNumber(companyId: string) {
  const year = new Date().getFullYear();
  const prefix = `SAL-${year}-`;
  const count = await Sale.countDocuments({
    companyId,
    saleNumber: new RegExp(`^${prefix}`),
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

function assertCustomer(req: Request) {
  if (!req.user || req.user.role !== "customer") {
    throw new AppError("FORBIDDEN", "Customer login required", 403);
  }
  return req.user;
}

export async function storeRegister(req: Request, res: Response) {
  const result = await registerStoreCustomer({
    name: String(req.body.name ?? ""),
    email: String(req.body.email ?? ""),
    phone: String(req.body.phone ?? ""),
    password: String(req.body.password ?? ""),
    address: req.body.address ? String(req.body.address) : undefined,
    area: req.body.area ? String(req.body.area) : undefined,
    branchId: req.body.branchId ? String(req.body.branchId) : undefined,
    coordinates:
      req.body.coordinates?.lat != null && req.body.coordinates?.lng != null
        ? { lat: Number(req.body.coordinates.lat), lng: Number(req.body.coordinates.lng) }
        : req.body.lat != null && req.body.lng != null
          ? { lat: Number(req.body.lat), lng: Number(req.body.lng) }
          : undefined,
  });
  return sendSuccess(res, result, 201);
}

export async function storeResolveLocation(req: Request, res: Response) {
  const companyId = await resolveStoreCompanyId();
  let coordinates =
    req.body.coordinates?.lat != null && req.body.coordinates?.lng != null
      ? { lat: Number(req.body.coordinates.lat), lng: Number(req.body.coordinates.lng) }
      : req.body.lat != null && req.body.lng != null
        ? { lat: Number(req.body.lat), lng: Number(req.body.lng) }
        : undefined;

  const address = req.body.address ? String(req.body.address).trim() : "";
  const preferredBranchId = req.body.branchId ? String(req.body.branchId).trim() : "";
  if (!coordinates && address) {
    coordinates = (await geocodeAddress(address)) ?? undefined;
  }
  if (!coordinates) {
    throw new AppError("BAD_REQUEST", "Pin your delivery location on the map", 400);
  }

  const nearest = await resolveNearestStoreBranch(
    companyId,
    coordinates,
    preferredBranchId || null
  );
  return sendSuccess(res, {
    coordinates,
    address: address || undefined,
    inService: nearest.inService,
    distanceKm: nearest.distanceKm,
    clusterId: nearest.clusterId,
    branch: nearest.branch,
    message: nearest.inService
      ? `Serving from ${nearest.branch.name}`
      : "We don't deliver in that area",
  });
}

export async function storeUpdateLocation(req: Request, res: Response) {
  const user = assertCustomer(req);
  const result = await updateStoreCustomerLocation(String(user._id), {
    address: req.body.address ? String(req.body.address) : undefined,
    area: req.body.area ? String(req.body.area) : undefined,
    branchId: req.body.branchId ? String(req.body.branchId) : undefined,
    coordinates:
      req.body.coordinates?.lat != null && req.body.coordinates?.lng != null
        ? { lat: Number(req.body.coordinates.lat), lng: Number(req.body.coordinates.lng) }
        : req.body.lat != null && req.body.lng != null
          ? { lat: Number(req.body.lat), lng: Number(req.body.lng) }
          : undefined,
  });
  return sendSuccess(res, result);
}

export async function storeLogin(req: Request, res: Response) {
  const result = await loginStoreCustomer(String(req.body.email ?? ""), String(req.body.password ?? ""));
  return sendSuccess(res, result);
}

export async function storeLogout(req: Request, res: Response) {
  if (req.user?._id) await logoutUser(String(req.user._id));
  return sendSuccess(res, { message: "Logged out" });
}

export async function storeMe(req: Request, res: Response) {
  const user = assertCustomer(req);
  const profile = await getStoreCustomerProfile(String(user._id));
  return sendSuccess(res, profile);
}

export async function listStoreBranches(_req: Request, res: Response) {
  const companyId = await resolveStoreCompanyId();
  const branches = await Branch.find({
    companyId,
    deletedAt: null,
    status: "active",
    $or: [{ parentBranchId: null }, { parentBranchId: { $exists: false } }],
  })
    .select("_id name code address deliveryRadiusKm gpsCoordinates")
    .sort({ name: 1 })
    .lean();

  return sendSuccess(
    res,
    branches.map((b) => ({
      _id: String(b._id),
      name: b.name,
      code: b.code,
      address: b.address,
      deliveryRadiusKm: b.deliveryRadiusKm ?? 10,
      gpsCoordinates:
        b.gpsCoordinates?.lat != null && b.gpsCoordinates?.lng != null
          ? { lat: b.gpsCoordinates.lat, lng: b.gpsCoordinates.lng }
          : undefined,
    }))
  );
}

export async function listStoreProducts(req: Request, res: Response) {
  const companyId = await resolveStoreCompanyId();
  const { page, limit, sortBy, sortOrder, skip } = parsePagination(req.query);

  let branchId = req.query.branchId ? String(req.query.branchId) : "";
  if (!branchId && req.user?.role === "customer") {
    const customer = await Customer.findOne({ userId: req.user._id, deletedAt: null })
      .select("branchId")
      .lean();
    branchId = customer?.branchId
      ? String(customer.branchId)
      : req.user.branchId
        ? String(req.user.branchId)
        : "";
  }

  // Browse mode (Foodpanda-style window): no branch yet → show catalog with total stock
  if (!branchId) {
    const filter: Record<string, unknown> = {
      companyId,
      deletedAt: null,
      status: "active",
    };
    if (req.query.category) filter.category = String(req.query.category);
    if (req.query.search) {
      const q = String(req.query.search);
      filter.$or = [
        { name: new RegExp(q, "i") },
        { sku: new RegExp(q, "i") },
        { brand: new RegExp(q, "i") },
        { category: new RegExp(q, "i") },
      ];
    }

    const [items, total, categories] = await Promise.all([
      Product.find(filter)
        .select(
          "name sku code category subCategory brand description sellingPrice unitOfMeasure images status"
        )
        .sort(buildSortQuery(sortBy ?? "name", sortOrder ?? "asc"))
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
      Product.distinct("category", {
        companyId,
        deletedAt: null,
        status: "active",
        category: { $nin: [null, ""] },
      }),
    ]);

    const productIds = items.map((p) => p._id);
    const stocks = await StockLevel.find({
      companyId,
      productId: { $in: productIds },
    })
      .select("productId currentStock")
      .lean();
    const stockByProduct = new Map<string, number>();
    for (const row of stocks) {
      const key = String(row.productId);
      stockByProduct.set(key, (stockByProduct.get(key) ?? 0) + (row.currentStock ?? 0));
    }

    return sendSuccess(
      res,
      {
        products: items.map((p) => ({
          ...p,
          availableStock: stockByProduct.get(String(p._id)) ?? 0,
        })),
        categories: categories.filter(Boolean).sort(),
        branch: null,
        browseMode: true,
      },
      200,
      buildMeta(page, limit, total)
    );
  }

  const branch = await Branch.findOne({
    _id: branchId,
    companyId,
    deletedAt: null,
  })
    .select("_id name code address deliveryRadiusKm")
    .lean();
  if (!branch) throw new AppError("NOT_FOUND", "Branch not found", 404);

  const stockRows = await StockLevel.find({ companyId, branchId: branch._id })
    .select("productId currentStock")
    .lean();
  const stockByProduct = new Map<string, number>();
  for (const row of stockRows) {
    stockByProduct.set(String(row.productId), row.currentStock ?? 0);
  }
  const productIds = [...stockByProduct.keys()];

  const filter: Record<string, unknown> = {
    companyId,
    deletedAt: null,
    status: "active",
    _id: { $in: productIds },
  };

  if (req.query.category) filter.category = String(req.query.category);
  if (req.query.search) {
    const q = String(req.query.search);
    filter.$or = [
      { name: new RegExp(q, "i") },
      { sku: new RegExp(q, "i") },
      { brand: new RegExp(q, "i") },
      { category: new RegExp(q, "i") },
    ];
  }

  const [items, total, categories] = await Promise.all([
    Product.find(filter)
      .select(
        "name sku code category subCategory brand description sellingPrice unitOfMeasure images status"
      )
      .sort(buildSortQuery(sortBy ?? "name", sortOrder ?? "asc"))
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
    Product.distinct("category", {
      companyId,
      deletedAt: null,
      status: "active",
      _id: { $in: productIds },
      category: { $nin: [null, ""] },
    }),
  ]);

  const enriched = items.map((p) => ({
    ...p,
    availableStock: stockByProduct.get(String(p._id)) ?? 0,
    branchId: String(branch._id),
  }));

  return sendSuccess(
    res,
    {
      products: enriched,
      categories: categories.filter(Boolean).sort(),
      branch: {
        _id: String(branch._id),
        name: branch.name,
        code: branch.code,
        address: branch.address,
        deliveryRadiusKm: branch.deliveryRadiusKm ?? 10,
      },
      browseMode: false,
    },
    200,
    buildMeta(page, limit, total)
  );
}

export async function getStoreProduct(req: Request, res: Response) {
  const companyId = await resolveStoreCompanyId();
  const branchId = req.query.branchId ? String(req.query.branchId) : "";

  const product = await Product.findOne({
    _id: req.params.id,
    companyId,
    deletedAt: null,
    status: "active",
  })
    .select(
      "name sku code category subCategory brand description specifications sellingPrice unitOfMeasure images status"
    )
    .lean();

  if (!product) throw new AppError("NOT_FOUND", "Product not found", 404);

  if (branchId) {
    const stock = await StockLevel.findOne({
      companyId,
      branchId,
      productId: product._id,
    })
      .select("currentStock")
      .lean();

    if (!stock) {
      throw new AppError("NOT_FOUND", "Product is not available at your branch", 404);
    }

    return sendSuccess(res, {
      ...product,
      availableStock: stock.currentStock ?? 0,
      branchId,
    });
  }

  const stockRows = await StockLevel.find({ companyId, productId: product._id })
    .select("currentStock")
    .lean();
  const availableStock = stockRows.reduce((sum, row) => sum + (row.currentStock ?? 0), 0);

  return sendSuccess(res, { ...product, availableStock, browseMode: true });
}

export async function storeCheckout(req: Request, res: Response) {
  const user = assertCustomer(req);
  const companyId = user.companyId ? String(user.companyId) : await resolveStoreCompanyId();

  const customer = await Customer.findOne({ userId: user._id, deletedAt: null });
  if (!customer) throw new AppError("NOT_FOUND", "Customer profile not found", 404);

  if (customer.coordinates?.lat == null || customer.coordinates?.lng == null) {
    throw new AppError(
      "OUT_OF_SERVICE",
      "Please pin your delivery location on the map before checkout",
      400
    );
  }

  const coverage = await resolveNearestStoreBranch(
    companyId,
    { lat: customer.coordinates.lat, lng: customer.coordinates.lng },
    customer.branchId ? String(customer.branchId) : null
  );
  if (!coverage.inService) {
    throw new AppError("OUT_OF_SERVICE", "We don't deliver in that area", 400);
  }

  const branchId = await resolveStoreBranchId(
    companyId,
    customer.branchId ? String(customer.branchId) : user.branchId ? String(user.branchId) : null
  );

  type RawItem = { productId: string; quantity: number };
  const rawItems: RawItem[] = Array.isArray(req.body.items) ? req.body.items : [];
  if (rawItems.length === 0) throw new AppError("BAD_REQUEST", "Cart is empty", 400);

  const merged = new Map<string, number>();
  for (const item of rawItems) {
    const id = String(item.productId);
    const qty = Number(item.quantity);
    if (!mongoose.isValidObjectId(id) || !Number.isFinite(qty) || qty < 1) {
      throw new AppError("BAD_REQUEST", "Invalid cart item", 400);
    }
    merged.set(id, (merged.get(id) ?? 0) + Math.floor(qty));
  }

  if (req.body.address?.trim()) customer.address = String(req.body.address).trim();
  if (req.body.area?.trim()) customer.area = String(req.body.area).trim();
  if (req.body.name?.trim()) customer.name = String(req.body.name).trim();
  customer.updatedBy = user._id;
  await customer.save();

  const lineItems: {
    product: InstanceType<typeof Product>;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[] = [];

  for (const [productId, quantity] of merged.entries()) {
    const product = await Product.findOne({
      _id: productId,
      companyId,
      deletedAt: null,
      status: "active",
    });
    if (!product) throw new AppError("NOT_FOUND", `Product not found: ${productId}`, 404);

    const stock = await StockLevel.findOne({ companyId, branchId, productId });
    if (!stock || stock.currentStock < quantity) {
      throw new AppError(
        "BAD_REQUEST",
        `Insufficient stock for ${product.name} (need ${quantity}, have ${stock?.currentStock ?? 0})`,
        400
      );
    }

    const unitPrice = product.sellingPrice ?? 0;
    lineItems.push({
      product,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    });
  }

  const totalQuantity = lineItems.reduce((sum, line) => sum + line.quantity, 0);
  const totalAmount = lineItems.reduce((sum, line) => sum + line.lineTotal, 0);
  const primary = lineItems[0];
  const saleNumber = await generateSaleNumber(companyId);

  const sale = await Sale.create({
    companyId,
    branchId,
    customerId: customer._id,
    productId: primary.product._id,
    saleNumber,
    quantity: totalQuantity,
    unitPrice: primary.unitPrice,
    totalAmount,
    items: lineItems.map((line) => ({
      productId: line.product._id,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    })),
    soldBy: user._id,
    notes: req.body.notes ? String(req.body.notes) : "Online store order",
    source: "store",
    status: "open",
  });

  for (const line of lineItems) {
    const updatedStock = await updateStockLevel({
      companyId,
      branchId,
      productId: line.product._id,
      quantity: -line.quantity,
      type: "sale",
      reason: `Store order ${saleNumber}`,
      referenceType: "Sale",
      referenceId: sale._id,
      userId: user._id,
    });
    await syncProductStockStatus(line.product._id);

    const reorderLevel = updatedStock.reorderLevel ?? line.product.reorderLevel ?? 0;
    if (updatedStock.currentStock <= reorderLevel && reorderLevel > 0) {
      const branch = await Branch.findById(branchId).select("name");
      await notifyLowStock(
        companyId,
        line.product.name,
        branch?.name ?? "Branch",
        updatedStock.currentStock,
        reorderLevel
      );
    }
  }

  const delivery = await createDeliveryFromSale(sale, customer, String(user._id), {
    orderSource: "store_app",
    promisedWindowStart: req.body.promisedWindowStart
      ? new Date(req.body.promisedWindowStart)
      : undefined,
    promisedWindowEnd: req.body.promisedWindowEnd
      ? new Date(req.body.promisedWindowEnd)
      : undefined,
  });

  const populated = await Sale.findById(sale._id)
    .populate("productId", "name sku images")
    .populate("items.productId", "name sku images")
    .populate("customerId", "name phone email address area")
    .populate("branchId", "name")
    .lean();

  const rider = delivery?.riderId;
  const riderCode =
    rider && typeof rider === "object" && "riderCode" in rider
      ? (rider as { riderCode?: string }).riderCode
      : undefined;

  return sendSuccess(
    res,
    {
      ...populated,
      delivery,
      riderAssigned: Boolean(delivery?.riderId),
      riderCode,
    },
    201
  );
}

export async function listStoreOrders(req: Request, res: Response) {
  const user = assertCustomer(req);
  const customer = await Customer.findOne({ userId: user._id, deletedAt: null }).select("_id");
  if (!customer) throw new AppError("NOT_FOUND", "Customer profile not found", 404);

  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = {
    customerId: customer._id,
    $or: [{ source: "store" }, { notes: /Online store order/i }],
  };

  const [items, total] = await Promise.all([
    Sale.find(filter)
      .populate("productId", "name sku images")
      .populate("items.productId", "name sku images")
      .populate("branchId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Sale.countDocuments(filter),
  ]);

  const saleIds = items.map((s) => s._id);
  const deliveries = await Delivery.find({
    saleId: { $in: saleIds },
    deletedAt: null,
  })
    .populate({
      path: "riderId",
      select: "riderCode currentLocation status",
      populate: { path: "employeeId", select: "firstName lastName" },
    })
    .lean();

  const bySale = new Map(deliveries.map((d) => [String(d.saleId), d]));

  const enriched = items.map((sale) => {
    const delivery = bySale.get(String(sale._id));
    const rider = delivery?.riderId;
    let riderCode: string | undefined;
    let riderName: string | undefined;
    if (rider && typeof rider === "object") {
      riderCode = "riderCode" in rider ? (rider as { riderCode?: string }).riderCode : undefined;
      const emp =
        "employeeId" in rider
          ? (rider as { employeeId?: { firstName?: string; lastName?: string } }).employeeId
          : undefined;
      if (emp && typeof emp === "object") {
        riderName = [emp.firstName, emp.lastName].filter(Boolean).join(" ").trim() || undefined;
      }
    }
    return {
      ...sale,
      delivery: delivery
        ? {
            _id: String(delivery._id),
            deliveryNumber: delivery.deliveryNumber,
            status: delivery.status,
            warehouseStatus: delivery.warehouseStatus,
            promisedWindowStart: delivery.promisedWindowStart,
            promisedWindowEnd: delivery.promisedWindowEnd,
            estimatedArrival: delivery.estimatedArrival,
            travelTimeMinutes: delivery.travelTimeMinutes,
          }
        : null,
      riderAssigned: Boolean(delivery?.riderId),
      riderCode,
      riderName,
    };
  });

  return sendSuccess(res, enriched, 200, buildMeta(page, limit, total));
}

export async function trackStoreOrder(req: Request, res: Response) {
  const user = assertCustomer(req);
  const customer = await Customer.findOne({ userId: user._id, deletedAt: null }).select("_id");
  if (!customer) throw new AppError("NOT_FOUND", "Customer profile not found", 404);

  const sale = await Sale.findOne({
    _id: req.params.id,
    customerId: customer._id,
    $or: [{ source: "store" }, { notes: /Online store order/i }],
  })
    .populate("items.productId", "name sku images")
    .populate("branchId", "name address gpsCoordinates")
    .lean();

  if (!sale) throw new AppError("NOT_FOUND", "Order not found", 404);

  const delivery = await Delivery.findOne({ saleId: sale._id, deletedAt: null })
    .populate({
      path: "riderId",
      select: "riderCode currentLocation status isOnShift",
      populate: { path: "employeeId", select: "firstName lastName phone" },
    })
    .lean();

  if (!delivery) throw new AppError("NOT_FOUND", "Delivery not found for this order", 404);

  const rider = delivery.riderId;
  let riderPayload: Record<string, unknown> | null = null;
  if (rider && typeof rider === "object") {
    const emp =
      "employeeId" in rider
        ? (rider as {
            employeeId?: { firstName?: string; lastName?: string; phone?: string };
          }).employeeId
        : undefined;
    const loc =
      "currentLocation" in rider
        ? (rider as {
            currentLocation?: { lat?: number; lng?: number; updatedAt?: Date };
          }).currentLocation
        : undefined;
    riderPayload = {
      riderCode: (rider as { riderCode?: string }).riderCode,
      name:
        emp && typeof emp === "object"
          ? [emp.firstName, emp.lastName].filter(Boolean).join(" ").trim()
          : undefined,
      phone: emp && typeof emp === "object" ? emp.phone : undefined,
      status: (rider as { status?: string }).status,
      location:
        loc?.lat != null && loc?.lng != null
          ? { lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt }
          : null,
    };
  }

  const now = Date.now();
  const etaMs = delivery.estimatedArrival
    ? new Date(delivery.estimatedArrival).getTime() - now
    : delivery.promisedWindowEnd
      ? new Date(delivery.promisedWindowEnd).getTime() - now
      : null;

  return sendSuccess(res, {
    order: {
      _id: String(sale._id),
      saleNumber: sale.saleNumber,
      totalAmount: sale.totalAmount,
      quantity: sale.quantity,
      createdAt: sale.createdAt,
      items: sale.items,
      branch: sale.branchId,
    },
    delivery: {
      _id: String(delivery._id),
      deliveryNumber: delivery.deliveryNumber,
      status: delivery.status,
      warehouseStatus: delivery.warehouseStatus,
      deliveryAddress: delivery.deliveryAddress,
      area: delivery.area,
      coordinates: delivery.coordinates,
      promisedWindowStart: delivery.promisedWindowStart,
      promisedWindowEnd: delivery.promisedWindowEnd,
      estimatedArrival: delivery.estimatedArrival,
      travelTimeMinutes: delivery.travelTimeMinutes,
      actualDeliveryAt: delivery.actualDeliveryAt,
    },
    rider: riderPayload,
    eta: {
      estimatedArrival: delivery.estimatedArrival ?? delivery.promisedWindowEnd ?? null,
      minutesRemaining:
        etaMs != null && Number.isFinite(etaMs) && etaMs > 0
          ? Math.round(etaMs / 60000)
          : etaMs != null && Number.isFinite(etaMs)
            ? 0
            : null,
      travelTimeMinutes: delivery.travelTimeMinutes ?? null,
    },
  });
}

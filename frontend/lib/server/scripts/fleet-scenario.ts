/**
 * Real-Time Fleet Dispatch — end-to-end scenario runner.
 *
 * Drives the ACTUAL dispatch engine (delivery.service + dispatch-engine.service)
 * with the orders from the business scenario, auto-assigns riders, spins up an
 * extra rider when a new cluster appears, runs operational scenarios 1–5, and
 * prints an end-of-day KPI report.
 *
 * Run:  npm run fleet-scenario   (from the frontend/ folder)
 */
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { Company } from "../models/Company.model";
import { Branch } from "../models/Branch.model";
import { User } from "../models/User.model";
import { Employee } from "../models/Employee.model";
import { Product } from "../models/Product.model";
import { Customer } from "../models/Customer.model";
import { DeliveryCluster } from "../models/DeliveryCluster.model";
import { Rider } from "../models/Rider.model";
import { Sale } from "../models/Sale.model";
import { Delivery } from "../models/Delivery.model";
import { DeliveryRun } from "../models/DeliveryRun.model";
import { createDeliveryFromSale } from "../services/delivery.service";
import {
  optimiseFleetPlan,
  offerRescheduleWindows,
  confirmDeliveryPromise,
  handleCustomerUnavailable,
  handleRiderBreakdown,
  computeDeliveryKpis,
  HIGH_VALUE_THRESHOLD,
  LOW_VALUE_THRESHOLD,
} from "../services/dispatch-engine.service";
import { optimizeRoute } from "../services/route-optimization.service";

const COMPANY_CODE = "FLEETDEMO";
const WAREHOUSE = { lat: 23.588, lng: 58.3829 };

/** Four ~5 km clusters around the warehouse (non-overlapping) */
const CLUSTERS = [
  { code: "CL-A", name: "Cluster A", center: { lat: WAREHOUSE.lat + 0.12, lng: WAREHOUSE.lng } },
  { code: "CL-B", name: "Cluster B", center: { lat: WAREHOUSE.lat, lng: WAREHOUSE.lng + 0.13 } },
  { code: "CL-C", name: "Cluster C", center: { lat: WAREHOUSE.lat - 0.12, lng: WAREHOUSE.lng } },
  { code: "CL-D", name: "Cluster D", center: { lat: WAREHOUSE.lat, lng: WAREHOUSE.lng - 0.13 } },
];

function line(char = "─", n = 78) {
  return char.repeat(n);
}
function heading(title: string) {
  console.log(`\n${line("═")}\n  ${title}\n${line("═")}`);
}
function fmtTime(d?: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

type Ctx = {
  companyId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  clusterCenter: Map<string, { lat: number; lng: number }>;
};

let saleSeq = 0;
let custSeq = 0;

async function cleanup() {
  const existing = await Company.findOne({ code: COMPANY_CODE });
  if (!existing) return;
  const companyId = existing._id;
  await Promise.all([
    Delivery.deleteMany({ companyId }),
    DeliveryRun.deleteMany({ companyId }),
    Sale.deleteMany({ companyId }),
    Customer.deleteMany({ companyId }),
    DeliveryCluster.deleteMany({ companyId }),
    Rider.deleteMany({ companyId }),
    Employee.deleteMany({ companyId }),
    Product.deleteMany({ companyId }),
    Branch.deleteMany({ companyId }),
    User.deleteMany({ email: /@fleetdemo\.test$/ }),
  ]);
  await Company.deleteOne({ _id: companyId });
}

async function setup(): Promise<Ctx> {
  const user = await User.create({
    email: "dispatch@fleetdemo.test",
    password: "x",
    firstName: "Dispatch",
    lastName: "Bot",
    role: "super_admin",
    isActive: true,
  });

  const company = await Company.create({
    name: "Fleet Demo Distribution",
    code: COMPANY_CODE,
    email: "ops@fleetdemo.test",
    phone: "+968 2400 0000",
    address: "Muscat",
    createdBy: user._id,
  });

  const branch = await Branch.create({
    companyId: company._id,
    name: "Fleet Demo Warehouse",
    code: "FD-WH",
    address: "Muscat",
    gpsCoordinates: WAREHOUSE,
    allowedRadius: 200,
    deliveryRadiusKm: 20,
    deliveryClusterCount: 4,
    createdBy: user._id,
  });

  const product = await Product.create({
    companyId: company._id,
    name: "Demo Case",
    code: "FD-PRD-1",
    sku: "FD-SKU-1",
    barcode: "9680000000099",
    qrCodeData: JSON.stringify({ sku: "FD-SKU-1" }),
    category: "Food",
    purchaseCost: 1,
    sellingPrice: 1,
    unitOfMeasure: "case",
    reorderLevel: 5,
    status: "active",
    createdBy: user._id,
  });

  const clusterCenter = new Map<string, { lat: number; lng: number }>();
  for (const c of CLUSTERS) {
    await DeliveryCluster.create({
      companyId: company._id,
      branchId: branch._id,
      code: c.code,
      name: c.name,
      center: c.center,
      origin: WAREHOUSE,
      shape: "circle",
      radiusKm: 5,
      status: "active",
      createdBy: user._id,
    });
    clusterCenter.set(c.name, c.center);
  }

  console.log(`Company ......... ${company.name} (${company.code})`);
  console.log(`Warehouse ....... ${WAREHOUSE.lat}, ${WAREHOUSE.lng}`);
  console.log(`Clusters ........ ${CLUSTERS.map((c) => c.name).join(", ")}  (5 km radius each)`);

  return {
    companyId: company._id,
    branchId: branch._id,
    productId: product._id,
    userId: user._id,
    clusterCenter,
  };
}

async function addRider(ctx: Ctx, letter: string, capacity = 20) {
  const emp = await Employee.create({
    employeeId: `FD-EMP-${letter}`,
    companyId: ctx.companyId,
    branchId: ctx.branchId,
    firstName: `Rider`,
    lastName: letter,
    email: `rider.${letter.toLowerCase()}@fleetdemo.test`,
    employmentType: "full_time",
    status: "active",
    hasVehicle: true,
    createdBy: ctx.userId,
  });
  const rider = await Rider.create({
    companyId: ctx.companyId,
    branchId: ctx.branchId,
    employeeId: emp._id,
    riderCode: `RIDER-${letter}`,
    status: "available",
    isOnShift: true,
    shiftStartedAt: new Date(),
    vehicleCapacityUnits: capacity,
    currentLocation: { ...WAREHOUSE, updatedAt: new Date() },
    createdBy: ctx.userId,
  });
  console.log(`  + ${rider.riderCode} is now AVAILABLE (capacity ${capacity})`);
  return rider;
}

async function placeOrder(
  ctx: Ctx,
  opts: { code: string; cluster: string; value: number; orderSource?: string; jitter?: number }
) {
  const center = ctx.clusterCenter.get(opts.cluster)!;
  // tiny jitter so multiple customers in one cluster get distinct pins
  const j = (opts.jitter ?? 0) * 0.004;
  const coords = { lat: center.lat + j, lng: center.lng + j };

  custSeq += 1;
  const customer = await Customer.create({
    companyId: ctx.companyId,
    phone: `+96890${String(100000 + custSeq)}`,
    name: opts.code,
    address: `${opts.code} — ${opts.cluster}`,
    area: opts.cluster,
    coordinates: coords,
    createdBy: ctx.userId,
  });

  saleSeq += 1;
  const sale = await Sale.create({
    companyId: ctx.companyId,
    branchId: ctx.branchId,
    customerId: customer._id,
    productId: ctx.productId,
    saleNumber: `FD-SAL-${String(saleSeq).padStart(4, "0")}`,
    quantity: 1,
    unitPrice: opts.value,
    totalAmount: opts.value,
    soldBy: ctx.userId,
  });

  const delivery = await createDeliveryFromSale(sale, customer, String(ctx.userId), {
    orderSource: (opts.orderSource as never) ?? "new_order",
  });

  return { customer, sale, delivery };
}

/** Print the current assignment grouped by cluster → rider */
async function report(ctx: Ctx, title: string) {
  heading(title);
  const dels = await Delivery.find({
    companyId: ctx.companyId,
    branchId: ctx.branchId,
    deletedAt: null,
  })
    .populate("clusterId", "code name")
    .populate("riderId", "riderCode")
    .populate("customerId", "name")
    .populate("saleId", "totalAmount")
    .sort({ createdAt: 1 })
    .lean();

  const groups = new Map<string, typeof dels>();
  for (const d of dels) {
    const cl = d.clusterId as { name?: string } | null;
    const key = cl?.name ?? "Unclustered";
    const arr = groups.get(key) ?? [];
    arr.push(d);
    groups.set(key, arr);
  }

  for (const [cluster, arr] of [...groups.entries()].sort()) {
    const value = arr.reduce((s, d) => s + ((d.saleId as { totalAmount?: number })?.totalAmount ?? 0), 0);
    console.log(`\n[${cluster}]   (${arr.length} orders · value ${value.toLocaleString()})`);
    for (const d of arr) {
      const cust = (d.customerId as { name?: string })?.name ?? "?";
      const rider = (d.riderId as { riderCode?: string })?.riderCode ?? "· unassigned";
      const val = (d.saleId as { totalAmount?: number })?.totalAmount ?? 0;
      const win = `${fmtTime(d.promisedWindowStart)}-${fmtTime(d.promisedWindowEnd)}`;
      console.log(
        `     ${cust.padEnd(4)}  ${String(val).padStart(6)}  →  ${String(rider).padEnd(9)}  ${d.status.padEnd(18)} win ${win}`
      );
    }
  }
}

/** Are all deliveries of a cluster on the same rider? */
async function clusterRiders(ctx: Ctx, clusterName: string) {
  const cluster = await DeliveryCluster.findOne({ companyId: ctx.companyId, name: clusterName }).lean();
  const dels = await Delivery.find({
    companyId: ctx.companyId,
    clusterId: cluster?._id,
    deletedAt: null,
  })
    .populate("riderId", "riderCode")
    .lean();
  const riders = new Set(dels.map((d) => (d.riderId as { riderCode?: string })?.riderCode ?? "unassigned"));
  return { count: dels.length, riders: [...riders] };
}

async function endOfDay(ctx: Ctx) {
  heading("END OF DAY — Fleet Optimisation KPIs");

  const dels = await Delivery.find({ companyId: ctx.companyId, deletedAt: null })
    .populate("riderId", "riderCode")
    .populate("saleId", "totalAmount")
    .lean();

  const byRider = new Map<string, { code: string; stops: { lat: number; lng: number; value: number }[] }>();
  let promised = 0;
  for (const d of dels) {
    if (d.promisedWindowStart) promised += 1;
    const code = (d.riderId as { riderCode?: string })?.riderCode;
    if (!code || !d.coordinates?.lat) continue;
    const entry = byRider.get(code) ?? { code, stops: [] };
    entry.stops.push({
      lat: d.coordinates.lat,
      lng: d.coordinates.lng,
      value: (d.saleId as { totalAmount?: number })?.totalAmount ?? 0,
    });
    byRider.set(code, entry);
  }

  let totalKm = 0;
  let totalStops = 0;
  let totalGm = 0;
  console.log(`\nPer-rider utilisation:`);
  for (const { code, stops } of [...byRider.values()].sort((a, b) => a.code.localeCompare(b.code))) {
    const route = await optimizeRoute(WAREHOUSE, stops.map((s, i) => ({ id: String(i), lat: s.lat, lng: s.lng })));
    const kpis = computeDeliveryKpis(stops.map((s) => ({ totalAmount: s.value })), route.totalDistanceMeters);
    const km = route.totalDistanceMeters / 1000;
    totalKm += km;
    totalStops += stops.length;
    totalGm += stops.reduce((s, x) => s + x.value * 0.3, 0);
    console.log(
      `  ${code.padEnd(9)} stops ${String(stops.length).padStart(2)} · route ${km.toFixed(1).padStart(5)} km · ` +
        `deliveries/km ${kpis.deliveriesPerKm.toFixed(2)} · GM/km ${kpis.grossMarginPerKm.toFixed(0)}`
    );
  }

  console.log(`\nNetwork totals:`);
  console.log(`  Delivery promises issued .... ${promised}/${dels.length}`);
  console.log(`  Active riders used .......... ${byRider.size}`);
  console.log(`  Total stops ................. ${totalStops}`);
  console.log(`  Total route distance ........ ${totalKm.toFixed(1)} km`);
  console.log(`  Deliveries per km (network) . ${(totalStops / (totalKm || 1)).toFixed(2)}`);
  console.log(`  Gross margin per km (network) ${(totalGm / (totalKm || 1)).toFixed(0)}`);
  console.log(`  Cost per delivery (est.) .... ${((totalKm * 0.15) / (totalStops || 1)).toFixed(3)}`);
}

async function main() {
  await connectDatabase();
  console.log(`Thresholds: HIGH_VALUE >= ${HIGH_VALUE_THRESHOLD}, LOW_VALUE < ${LOW_VALUE_THRESHOLD}`);

  await cleanup();
  heading("SETUP — Distribution model");
  const ctx = await setup();

  heading("09:00 — Available fleet");
  await addRider(ctx, "A");
  await addRider(ctx, "B");
  await addRider(ctx, "C");

  // ── Morning warehouse demand queue ────────────────────────────────
  heading("08:45–09:10 — Warehouse demand queue (auto-assign)");
  const morning = [
    { code: "C1", cluster: "Cluster A", value: 18000, orderSource: "previous_day" },
    { code: "C2", cluster: "Cluster A", value: 8000, orderSource: "replenishment", jitter: 1 },
    { code: "C3", cluster: "Cluster B", value: 22000, orderSource: "standing_daily" },
    { code: "C4", cluster: "Cluster C", value: 16000, orderSource: "new_order" },
    { code: "C5", cluster: "Cluster A", value: 5000, orderSource: "new_order", jitter: 2 },
    { code: "C6", cluster: "Cluster C", value: 20000, orderSource: "scheduled", jitter: 1 },
  ];
  for (const o of morning) {
    const { delivery } = await placeOrder(ctx, o);
    console.log(
      `  ${o.code}  ${o.cluster.padEnd(9)}  ${String(o.value).padStart(6)}  → window ${fmtTime(
        delivery?.promisedWindowStart
      )}-${fmtTime(delivery?.promisedWindowEnd)}`
    );
  }
  await optimiseFleetPlan({ companyId: String(ctx.companyId), branchId: String(ctx.branchId), trigger: "morning" });
  await report(ctx, "09:10 — First delivery runs created");

  for (const name of ["Cluster A", "Cluster B", "Cluster C"]) {
    const r = await clusterRiders(ctx, name);
    console.log(`  ✓ ${name}: ${r.count} orders on rider(s) [${r.riders.join(", ")}]`);
  }

  // ── 09:40 new orders (Cluster D appears → add a rider) ─────────────
  heading("09:40 — Four new orders arrive (Cluster D is new)");
  console.log("Cluster D has no rider yet → provisioning an extra rider:");
  await addRider(ctx, "D");

  const midday = [
    { code: "C7", cluster: "Cluster A", value: 3000, orderSource: "new_order", jitter: 3 },
    { code: "C8", cluster: "Cluster B", value: 12000, orderSource: "new_order", jitter: 1 },
    { code: "C9", cluster: "Cluster B", value: 15000, orderSource: "standing_weekly", jitter: 2 },
    { code: "C10", cluster: "Cluster D", value: 28000, orderSource: "new_order" },
  ];
  for (const o of midday) {
    const { delivery } = await placeOrder(ctx, o);
    console.log(
      `  ${o.code.padEnd(3)} ${o.cluster.padEnd(9)} ${String(o.value).padStart(6)}  → window ${fmtTime(
        delivery?.promisedWindowStart
      )}-${fmtTime(delivery?.promisedWindowEnd)}`
    );
  }
  await optimiseFleetPlan({ companyId: String(ctx.companyId), branchId: String(ctx.branchId), trigger: "midday" });
  const dCheck = await clusterRiders(ctx, "Cluster D");
  console.log(`  ✓ Cluster D now served: ${dCheck.count} order(s) on [${dCheck.riders.join(", ")}]`);

  // ── Scenario 1 — High-value urgent order ───────────────────────────
  heading("SCENARIO 1 — High-value urgent order (60,000, Cluster D)");
  const before1 = await clusterRiders(ctx, "Cluster D");
  const hv = await placeOrder(ctx, { code: "HV", cluster: "Cluster D", value: 60000, orderSource: "new_order", jitter: 4 });
  await optimiseFleetPlan({ companyId: String(ctx.companyId), branchId: String(ctx.branchId), trigger: "high_value" });
  const after1 = await clusterRiders(ctx, "Cluster D");
  console.log(`  Value 60,000 >= HIGH_VALUE(${HIGH_VALUE_THRESHOLD}) → engine evaluates dedicated vs grouped run`);
  console.log(`  Cluster D before: ${before1.count} orders on [${before1.riders.join(", ")}]`);
  console.log(`  Cluster D after : ${after1.count} orders on [${after1.riders.join(", ")}]`);
  console.log(`  HV delivery status: ${hv.delivery?.status}, rider assigned: ${Boolean(hv.delivery?.riderId)}`);

  // ── Scenario 2 — Low-value order grouped ──────────────────────────
  heading("SCENARIO 2 — Low-value order (900, Cluster A) is grouped");
  const lv = await placeOrder(ctx, { code: "LV", cluster: "Cluster A", value: 900, orderSource: "new_order", jitter: 5 });
  const lvCluster = await clusterRiders(ctx, "Cluster A");
  console.log(`  Value 900 < LOW_VALUE(${LOW_VALUE_THRESHOLD}) → bundled into the next Cluster A run`);
  console.log(`  Cluster A now: ${lvCluster.count} orders on [${lvCluster.riders.join(", ")}]`);
  console.log(
    `  LV order got a confirmed window immediately: ${fmtTime(lv.delivery?.promisedWindowStart)}-${fmtTime(
      lv.delivery?.promisedWindowEnd
    )} (rider ${Boolean(lv.delivery?.riderId) ? "assigned" : "pending"})`
  );

  // ── Scenario 3 — Customer requests another time ───────────────────
  heading("SCENARIO 3 — Customer requests another delivery window");
  const c1Del = await Delivery.findOne({ companyId: ctx.companyId })
    .populate("customerId", "name")
    .sort({ createdAt: 1 })
    .lean();
  if (c1Del) {
    const offer = await offerRescheduleWindows(String(c1Del._id));
    const chosen = offer?.alternativeWindows?.[1] ?? offer?.alternativeWindows?.[0];
    console.log(`  Order ${(c1Del.customerId as { name?: string })?.name} current window: ${fmtTime(c1Del.promisedWindowStart)}-${fmtTime(c1Del.promisedWindowEnd)}`);
    console.log(`  Offered alternatives: ${offer?.alternativeWindows?.map((w) => `${fmtTime(w.start)}-${fmtTime(w.end)}`).join("  |  ")}`);
    if (chosen) {
      const updated = await confirmDeliveryPromise(String(c1Del._id), chosen);
      console.log(`  Customer selected → new promise: ${fmtTime(updated?.promisedWindowStart)}-${fmtTime(updated?.promisedWindowEnd)}  (status ${updated?.status})`);
    }
  }

  // ── Scenario 4 — Customer unavailable ─────────────────────────────
  heading("SCENARIO 4 — Customer unavailable on delivery");
  const c3Del = await Delivery.findOne({ companyId: ctx.companyId })
    .populate("customerId", "name")
    .sort({ createdAt: -1 })
    .lean();
  if (c3Del) {
    const res = await handleCustomerUnavailable(String(c3Del._id));
    const after = await Delivery.findById(c3Del._id).lean();
    console.log(`  Order ${(c3Del.customerId as { name?: string })?.name} marked unavailable → status: ${after?.status}, reason: ${after?.failureReason}`);
    console.log(`  New windows offered: ${res?.alternativeWindows?.map((w) => `${fmtTime(w.start)}-${fmtTime(w.end)}`).join("  |  ")}`);
  }

  // ── Scenario 5 — Rider breakdown ──────────────────────────────────
  heading("SCENARIO 5 — Rider breakdown (unlocked stops reassigned)");
  const riderA = await Rider.findOne({ companyId: ctx.companyId, riderCode: "RIDER-A" }).lean();
  if (riderA) {
    const before = await Delivery.countDocuments({
      companyId: ctx.companyId,
      riderId: riderA._id,
      deletedAt: null,
      status: { $in: ["scheduled", "pending_assignment"] },
    });
    const res = await handleRiderBreakdown(String(riderA._id));
    console.log(`  RIDER-A broke down (had ${before} unlocked stop(s))`);
    console.log(`  Reassigned ${res.reassigned} delivery(ies) to remaining fleet / future runs`);
    const stillA = await Delivery.countDocuments({
      companyId: ctx.companyId,
      riderId: riderA._id,
      deletedAt: null,
      assignmentLocked: false,
      status: { $in: ["scheduled", "pending_assignment"] },
    });
    console.log(`  Unlocked stops still on RIDER-A after re-optimise: ${stillA} (should be 0)`);
  }

  await report(ctx, "FINAL STATE — after all scenarios");
  await endOfDay(ctx);

  heading("RESULT");
  console.log("  Scenario executed end-to-end against the live dispatch engine.");
  console.log("  Orders were auto-assigned to riders by cluster, an extra rider was");
  console.log("  provisioned for the new cluster, and all five operational scenarios ran.");

  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});

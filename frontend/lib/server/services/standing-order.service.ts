import { StandingOrder } from "../models/StandingOrder.model";
import { Sale } from "../models/Sale.model";
import { Customer } from "../models/Customer.model";
import { Product } from "../models/Product.model";
import { updateStockLevel, syncProductStockStatus } from "./inventory.service";
import { createDeliveryFromSale } from "./delivery.service";
import type { OrderSource } from "./dispatch-engine.service";

async function generateSaleNumber(companyId: string) {
  const year = new Date().getFullYear();
  const prefix = `SAL-${year}-`;
  const count = await Sale.countDocuments({
    companyId,
    saleNumber: new RegExp(`^${prefix}`),
  });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}

function nextDueDate(from: Date, frequency: string): Date {
  const d = new Date(from);
  if (frequency === "standing_daily") d.setDate(d.getDate() + 1);
  else if (frequency === "standing_weekly") d.setDate(d.getDate() + 7);
  else d.setDate(d.getDate() + 14);
  d.setHours(8, 0, 0, 0);
  return d;
}

/** Auto-create deliveries for standing orders that are due — no manual entry */
export async function processStandingOrdersDue(input: {
  companyId: string;
  branchId: string;
  userId: string;
  before?: Date;
}) {
  const cutoff = input.before ?? new Date();
  const due = await StandingOrder.find({
    companyId: input.companyId,
    branchId: input.branchId,
    status: "active",
    deletedAt: null,
    nextDueAt: { $lte: cutoff },
  });

  const created: string[] = [];

  for (const order of due) {
    const customer = await Customer.findById(order.customerId);
    const product = await Product.findById(order.productId);
    if (!customer || !product) continue;

    const unitPrice = order.unitPrice ?? product.sellingPrice ?? 0;
    const saleNumber = await generateSaleNumber(String(order.companyId));

    const sale = await Sale.create({
      companyId: order.companyId,
      branchId: order.branchId,
      customerId: order.customerId,
      productId: order.productId,
      saleNumber,
      quantity: order.quantity,
      unitPrice,
      totalAmount: unitPrice * order.quantity,
      soldBy: input.userId,
      notes: `Standing order (${order.frequency})`,
    });

    await updateStockLevel({
      companyId: order.companyId,
      branchId: order.branchId,
      productId: order.productId,
      quantity: -order.quantity,
      type: "sale",
      reason: `Standing order ${saleNumber}`,
      referenceType: "Sale",
      referenceId: sale._id,
      userId: input.userId,
    });

    await syncProductStockStatus(order.productId);

    await createDeliveryFromSale(sale, customer, input.userId, {
      orderSource: order.frequency as OrderSource,
    });

    order.nextDueAt = nextDueDate(order.nextDueAt, order.frequency);
    await order.save();
    created.push(saleNumber);
  }

  return { processed: created.length, saleNumbers: created };
}

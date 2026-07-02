import { User } from "../models/User.model";
import { createNotification } from "./notification.service";
import type mongoose from "mongoose";

export async function notifyCompanyRoleUsers(
  companyId: mongoose.Types.ObjectId | string,
  roles: string[],
  payload: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }
) {
  const users = await User.find({
    companyId,
    role: { $in: roles },
    isActive: true,
    deletedAt: null,
  }).select("_id");

  await Promise.all(
    users.map((u) =>
      createNotification({
        userId: u._id,
        companyId: companyId as mongoose.Types.ObjectId,
        type: payload.type as Parameters<typeof createNotification>[0]["type"],
        title: payload.title,
        message: payload.message,
        data: payload.data,
      })
    )
  );
}

export async function notifyLowStock(
  companyId: mongoose.Types.ObjectId | string,
  productName: string,
  branchName: string,
  currentStock: number,
  reorderLevel: number
) {
  await notifyCompanyRoleUsers(
    companyId,
    ["business_owner", "inventory_manager", "procurement_manager", "branch_manager"],
    {
      type: "low_stock",
      title: "Low Stock Alert",
      message: `${productName} at ${branchName} is low (${currentStock} remaining, reorder at ${reorderLevel})`,
      data: { productName, branchName, currentStock, reorderLevel },
    }
  );
}

export async function notifyPurchaseApproval(
  companyId: mongoose.Types.ObjectId | string,
  poNumber: string
) {
  await notifyCompanyRoleUsers(
    companyId,
    ["business_owner", "procurement_manager", "inventory_manager"],
    {
      type: "purchase_approval",
      title: "Purchase Approval Needed",
      message: `Purchase order ${poNumber} requires approval`,
      data: { poNumber },
    }
  );
}

export async function notifyStockTransferRequest(
  companyId: mongoose.Types.ObjectId | string,
  transferNumber: string,
  fromBranch: string,
  toBranch: string
) {
  await notifyCompanyRoleUsers(
    companyId,
    ["business_owner", "inventory_manager", "branch_manager"],
    {
      type: "stock_transfer",
      title: "Stock Transfer Request",
      message: `Transfer ${transferNumber}: ${fromBranch} → ${toBranch}`,
      data: { transferNumber, fromBranch, toBranch },
    }
  );
}

export async function notifyStockReceived(
  companyId: mongoose.Types.ObjectId | string,
  grnNumber: string,
  poNumber: string
) {
  await notifyCompanyRoleUsers(
    companyId,
    ["business_owner", "inventory_manager", "procurement_manager"],
    {
      type: "stock_received",
      title: "Stock Received",
      message: `GRN ${grnNumber} created for PO ${poNumber}`,
      data: { grnNumber, poNumber },
    }
  );
}

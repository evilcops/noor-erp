export type DeliveryStatus =
  | "pending_assignment"
  | "scheduled"
  | "in_transit"
  | "delivered"
  | "failed"
  | "refused"
  | "rescheduled"
  | "cancelled";

export type DeliveryPriority = "low" | "normal" | "high" | "urgent";

export type WarehouseStatus =
  | "order_confirmed"
  | "picking"
  | "packing"
  | "ready_for_dispatch"
  | "waiting_for_rider"
  | "loaded"
  | "dispatched";

export type OrderSource =
  | "new_order"
  | "back_order"
  | "standing_daily"
  | "standing_weekly"
  | "standing_fortnightly"
  | "scheduled"
  | "previous_day"
  | "replenishment";

export interface Delivery {
  _id: string;
  companyId: string;
  branchId: string | { _id: string; name: string; code?: string };
  saleId: string | {
    _id: string;
    saleNumber: string;
    quantity: number;
    totalAmount: number;
    productId?: { name: string; sku: string };
  };
  customerId: string | {
    _id: string;
    name?: string;
    phone: string;
    address?: string;
    area?: string;
    coordinates?: { lat: number; lng: number };
  };
  riderId?: string | import("./rider").Rider;
  provisionalRiderId?: string;
  clusterId?: string | { _id: string; code?: string; name?: string };
  runId?: string;
  deliveryNumber: string;
  status: DeliveryStatus;
  warehouseStatus?: WarehouseStatus;
  orderSource?: OrderSource;
  priority: DeliveryPriority;
  priorityScore: number;
  scheduledDate?: string;
  timeSlotStart?: string;
  timeSlotEnd?: string;
  promisedWindowStart?: string;
  promisedWindowEnd?: string;
  promiseAcceptedAt?: string;
  preparationMinutes?: number;
  routeOrder?: number;
  queuePosition?: number;
  assignmentLocked?: boolean;
  currentDestinationLocked?: boolean;
  deliveryAddress?: string;
  area?: string;
  coordinates?: { lat: number; lng: number };
  estimatedArrival?: string;
  actualDeliveryAt?: string;
  cashCollected?: number;
  digitalPaymentAmount?: number;
  cashHandedOver?: boolean;
  failureReason?: string;
  notes?: string;
  createdAt: string;
}

export interface AssignDeliveryInput {
  riderId: string;
  scheduledDate: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  priority?: DeliveryPriority;
}

export interface DispatchDashboard {
  stats: {
    pending: number;
    scheduled: number;
    inTransit: number;
    delivered: number;
    activeRiders: number;
  };
  recentPending: Delivery[];
}

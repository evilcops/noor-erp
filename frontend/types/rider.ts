export type RiderStatus =
  | "active"
  | "inactive"
  | "on_delivery"
  | "off_duty"
  | "available"
  | "loading"
  | "returning_to_warehouse"
  | "break"
  | "offline";

export interface Rider {
  _id: string;
  companyId: string;
  branchId: string | { _id: string; name: string; code?: string };
  employeeId: string | {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    employeeId: string;
    status?: string;
    department?: string;
    designation?: string;
  };
  riderCode: string;
  drivingLicenseNumber?: string;
  drivingLicenseExpiry?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  whatsappPhone?: string;
  status: RiderStatus;
  isOnJourney: boolean;
  isOnShift?: boolean;
  vehicleCapacityUnits?: number;
  currentRunId?: string;
  predictedReturnAt?: string;
  currentLocation?: { lat: number; lng: number; updatedAt: string };
  todayDeliveries?: number;
  activeDeliveries?: number;
  createdAt: string;
}

export interface RiderDetail extends Rider {
  recentDeliveries?: import("./delivery").Delivery[];
}

export interface LiveRider extends Rider {
  activeDelivery?: import("./delivery").Delivery | null;
  remainingStops?: number;
}

export interface RiderRoutePoint {
  lat: number;
  lng: number;
  order: number;
  deliveryId?: string;
  label?: string;
  deliveryStatus?: string;
}

export interface RiderRouteSummary {
  runId?: string;
  runNumber?: string;
  runStatus?: "planning" | "loading" | "active" | "completed";
  completedAt?: string;
  startedAt?: string;
  estimatedReturnAt?: string;
  points: RiderRoutePoint[];
  pathGeometry: { lat: number; lng: number }[];
  outboundDistanceKm: number;
  returnDistanceKm: number;
  roundTripDistanceKm: number;
  totalDurationMin: number;
  roundTripCost: number;
  costPerKm: number;
  stopCount: number;
  deliveredCount?: number;
}

export interface RiderLocationSnapshot extends LiveRider {
  route?: RiderRouteSummary | null;
  previousRoute?: RiderRouteSummary | null;
  warehouse?: { lat: number; lng: number };
}

export interface RiderLocationsResult {
  dateFrom: string;
  dateTo: string;
  deliveryCount: number;
  totalRouteCost: number;
  totalRoundTripKm: number;
  riders: RiderLocationSnapshot[];
}

export interface RiderRoutePlan {
  warehouse: { lat: number; lng: number; label?: string };
  pathGeometry: { lat: number; lng: number }[];
  stops: { deliveryId: string; order: number; lat: number; lng: number; label: string }[];
  outboundDistanceKm: number;
  returnDistanceKm: number;
  roundTripDistanceKm: number;
  totalDurationMin: number;
  roundTripCost: number;
  costPerKm: number;
  stopCount: number;
}

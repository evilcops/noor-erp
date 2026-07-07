import type { DeliveryExpandedRegion } from "@/lib/compass-directions";

export interface BranchHoliday {
  name: string;
  date: string;
  isRecurring: boolean;
}

export interface Branch {
  _id: string;
  companyId: string;
  parentBranchId?: string | null | { _id: string; name: string; code?: string };
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  gpsCoordinates?: { lat: number; lng: number };
  allowedRadius?: number;
  holidays?: BranchHoliday[];
  status: "active" | "inactive";
  subBranchCount?: number;
  deliveryRadiusKm?: number;
  deliveryClusterCount?: number;
  deliveryExpandedRegions?: DeliveryExpandedRegion[] | null;
  clustersCreated?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBranchInput {
  companyId: string;
  parentBranchId?: string | null;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  gpsCoordinates?: { lat: number; lng: number };
  allowedRadius?: number;
  deliveryRadiusKm?: number;
  deliveryClusterCount?: number;
}

export type UpdateBranchInput = Partial<Omit<CreateBranchInput, "companyId">> & {
  status?: "active" | "inactive";
  parentBranchId?: string | null;
};

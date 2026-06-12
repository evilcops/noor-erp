export interface BranchHoliday {
  name: string;
  date: string;
  isRecurring: boolean;
}

export interface Branch {
  _id: string;
  companyId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  gpsCoordinates?: { lat: number; lng: number };
  allowedRadius?: number;
  holidays?: BranchHoliday[];
  status: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBranchInput {
  companyId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  gpsCoordinates?: { lat: number; lng: number };
  allowedRadius?: number;
}

export type UpdateBranchInput = Partial<Omit<CreateBranchInput, "companyId">> & {
  status?: "active" | "inactive";
};

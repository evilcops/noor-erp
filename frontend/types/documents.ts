export type BusinessDocType = "cr_certificate" | "chamber_of_commerce" | "custom";
export type BranchDocType =
  | "property_license"
  | "baladiya_license"
  | "pat_testing"
  | "smoke_alarm"
  | "building_insurance"
  | "fire_policy"
  | "money_policy"
  | "custom";

export type DocStatus = "valid" | "expired" | "expiring_soon";

export interface BusinessDocument {
  _id: string;
  companyId: string;
  type: BusinessDocType;
  customTypeName?: string;
  startDate?: string;
  expiryDate?: string;
  fileUrl?: string;
  status: DocStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchDocument {
  _id: string;
  companyId: string;
  branchId: string;
  type: BranchDocType;
  customTypeName?: string;
  issuanceDate?: string;
  expiryDate?: string;
  fileUrl?: string;
  status: DocStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpiringBusinessDocAlert {
  documentId: string;
  companyId: string;
  type: BusinessDocType;
  customTypeName?: string;
  expiryDate: string;
  daysRemaining: number;
  alertLevel: "critical" | "warning" | "notice";
}

export interface ExpiringBranchDocAlert {
  documentId: string;
  branchId: string;
  branchName: string;
  companyId: string;
  type: BranchDocType;
  customTypeName?: string;
  expiryDate: string;
  daysRemaining: number;
  alertLevel: "critical" | "warning" | "notice";
}

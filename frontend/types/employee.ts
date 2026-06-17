export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type EmployeeStatus =
  | "active"
  | "on_leave"
  | "suspended"
  | "resigned"
  | "terminated"
  | "archived";

/** Compliance document types tracked with expiry alerts */
export type ComplianceDocType =
  | "passport"
  | "driving_license"
  | "pataka"
  | "mulkiya"
  | "car_insurance";

/** Legacy/general document types */
export type LegacyDocType =
  | "visa"
  | "labour_card"
  | "id_card"
  | "contract"
  | "certificate";

export type DocumentType = ComplianceDocType | LegacyDocType;

export interface EmployeeDocument {
  _id?: string;
  type: DocumentType;
  number?: string;
  fileUrl?: string;
  issuanceDate?: string;
  expiryDate?: string;
  status: "valid" | "expired" | "expiring_soon";
  uploadedAt?: string;
}

export interface Employee {
  _id: string;
  employeeId: string;
  companyId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  department?: string;
  designation?: string;
  employmentType: EmploymentType;
  joiningDate?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  status: EmployeeStatus;
  hasVehicle?: boolean;
  documents: EmployeeDocument[];
  notes?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceDocInput {
  issuanceDate?: string;
  expiryDate?: string;
}

export interface ComplianceDocs {
  passport?: ComplianceDocInput;
  driving_license?: ComplianceDocInput;
  pataka?: ComplianceDocInput;
  mulkiya?: ComplianceDocInput;
  car_insurance?: ComplianceDocInput;
}

/** Files collected from the form — uploaded separately after employee creation */
export interface ComplianceFiles {
  passport?: File;
  driving_license?: File;
  pataka?: File;
  mulkiya?: File;
  car_insurance?: File;
}

export interface CreateEmployeeInput {
  companyId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  department?: string;
  designation?: string;
  employmentType?: EmploymentType;
  joiningDate?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  notes?: string;
  status?: EmployeeStatus;
  hasVehicle?: boolean;
  complianceDocs?: ComplianceDocs;
}

export type UpdateEmployeeInput = Partial<Omit<CreateEmployeeInput, "companyId" | "branchId">>;

/** Expiring document entry returned by the backend alert endpoint */
export interface ExpiringDocumentAlert {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  document: EmployeeDocument;
  daysRemaining: number;
  alertLevel: "critical" | "warning" | "notice";
}

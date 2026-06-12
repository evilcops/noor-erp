export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type EmployeeStatus =
  | "active"
  | "on_leave"
  | "suspended"
  | "resigned"
  | "terminated"
  | "archived";
export type DocumentType =
  | "passport"
  | "visa"
  | "labour_card"
  | "id_card"
  | "contract"
  | "certificate";

export interface EmployeeDocument {
  _id?: string;
  type: DocumentType;
  number?: string;
  fileUrl?: string;
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
  documents: EmployeeDocument[];
  notes?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
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
}

export type UpdateEmployeeInput = Partial<Omit<CreateEmployeeInput, "companyId" | "branchId">>;

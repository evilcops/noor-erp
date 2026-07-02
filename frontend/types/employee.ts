export type EmploymentType = "full_time" | "part_time" | "contract" | "intern";
export type EmployeeGender = "male" | "female" | "other";
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
  | "bataka"
  | "pataka" // legacy alias — will be migrated to bataka on startup
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

export interface EmployeeLeaveBalanceBucket {
  total: number;
  used: number;
  remaining: number;
}

export interface EmployeeLeaveBalance {
  year: number;
  annual: EmployeeLeaveBalanceBucket;
  sick: EmployeeLeaveBalanceBucket;
  emergency: EmployeeLeaveBalanceBucket;
  unpaid: EmployeeLeaveBalanceBucket;
  maternity: EmployeeLeaveBalanceBucket;
  paternity: EmployeeLeaveBalanceBucket;
}

export interface EmployeeLeaveBalanceInput {
  year?: number;
  annual: { total: number };
  sick: { total: number };
  emergency: { total: number };
  unpaid: { total: number };
  maternity: { total: number };
  paternity: { total: number };
}

export interface Employee {
  _id: string;
  employeeId: string;
  companyId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: EmployeeGender;
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
  profilePicture?: string;
  userId?: string;
  hasVehicle?: boolean;
  familyType?: "individual" | "family";
  familyMembers?: FamilyMember[];
  documents: EmployeeDocument[];
  leaveBalance?: EmployeeLeaveBalance | null;
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
  bataka?: ComplianceDocInput;
  mulkiya?: ComplianceDocInput;
  car_insurance?: ComplianceDocInput;
}

/** Files collected from the form — uploaded separately after employee creation */
export interface ComplianceFiles {
  passport?: File;
  driving_license?: File;
  bataka?: File;
  mulkiya?: File;
  car_insurance?: File;
}

export interface CreateEmployeeInput {
  companyId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  email: string;
  gender?: EmployeeGender;
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
  createUserAccount?: boolean;
  userPassword?: string;
  userRole?: "super_admin" | "business_owner" | "branch_manager" | "hr_manager" | "employee";
  leaveBalance: EmployeeLeaveBalanceInput;
}

export type UpdateEmployeeInput = Partial<Omit<CreateEmployeeInput, "companyId" | "branchId" | "leaveBalance">> & {
  leaveBalance?: EmployeeLeaveBalanceInput;
};

export type FamilyRelationship = "spouse" | "son" | "daughter" | "mother" | "father";

export interface FamilyMemberDocument {
  issueDate?: string;
  expiryDate?: string;
  fileUrl?: string;
  status: "valid" | "expired" | "expiring_soon";
}

export interface FamilyMember {
  _id?: string;
  name: string;
  profilePicture?: string;
  relationship: FamilyRelationship;
  bataka?: FamilyMemberDocument;
}

/** Expiring document entry returned by the backend alert endpoint */
export interface ExpiringDocumentAlert {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  document: EmployeeDocument;
  daysRemaining: number;
  alertLevel: "critical" | "warning" | "notice";
  isFamilyAlert?: boolean;
  familyMemberName?: string;
  familyMemberId?: string;
}

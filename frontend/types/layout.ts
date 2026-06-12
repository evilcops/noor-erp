export interface MockUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarInitial: string;
}

export interface MockBranch {
  id: string;
  name: string;
  code: string;
  city: string;
}

export interface MockCompany {
  id: string;
  name: string;
  branches: MockBranch[];
}

export interface MockNotification {
  id: string;
  title: string;
  description: string;
  time: Date;
  read: boolean;
  type: "info" | "warning" | "critical";
}

export interface BranchContextValue {
  companies: MockCompany[];
  companyId: string;
  branchId: string;
  company: MockCompany | null;
  branch: MockBranch | null;
  setCompany: (companyId: string) => void;
  setBranch: (branchId: string) => void;
}

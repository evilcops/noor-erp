import type { MockBranch, MockCompany, MockNotification, MockUser } from "@/types/layout";

export const MOCK_USER: MockUser = {
  id: "usr_001",
  fullName: "Ahmed Al-Rashdi",
  email: "ahmed@noor.om",
  role: "HR_MANAGER",
  avatarInitial: "A",
};

export const MOCK_COMPANIES: MockCompany[] = [
  {
    id: "co_001",
    name: "NOOR Trading LLC",
    branches: [
      { id: "br_001", name: "Muscat HQ", code: "MCT-HQ", city: "Muscat" },
      { id: "br_002", name: "Salalah Branch", code: "SLL-01", city: "Salalah" },
      { id: "br_003", name: "Sohar Branch", code: "SHR-01", city: "Sohar" },
    ],
  },
  {
    id: "co_002",
    name: "Gulf Services Co.",
    branches: [
      { id: "br_004", name: "Ruwi Office", code: "RWI-01", city: "Muscat" },
      { id: "br_005", name: "Nizwa Branch", code: "NZW-01", city: "Nizwa" },
    ],
  },
  {
    id: "co_003",
    name: "Al Noor Logistics",
    branches: [
      { id: "br_006", name: "Main Depot", code: "DEP-01", city: "Barka" },
      { id: "br_007", name: "Airport Hub", code: "APT-01", city: "Muscat" },
      { id: "br_008", name: "Duqm Port", code: "DQM-01", city: "Duqm" },
    ],
  },
];

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: "notif_001",
    title: "Leave request pending",
    description: "Fatima Al-Balushi requested 3 days annual leave.",
    time: new Date(Date.now() - 12 * 60000),
    read: false,
    type: "warning",
  },
  {
    id: "notif_002",
    title: "Document expiring soon",
    description: "Passport for Omar Hassan expires in 7 days.",
    time: new Date(Date.now() - 2 * 3600000),
    read: false,
    type: "critical",
  },
  {
    id: "notif_003",
    title: "Interview scheduled",
    description: "Candidate interview tomorrow at 10:00 AM.",
    time: new Date(Date.now() - 5 * 3600000),
    read: true,
    type: "info",
  },
  {
    id: "notif_004",
    title: "Late attendance alert",
    description: "3 employees checked in late today at Muscat HQ.",
    time: new Date(Date.now() - 24 * 3600000),
    read: true,
    type: "warning",
  },
];

export const DEFAULT_COMPANY_ID = MOCK_COMPANIES[0].id;
export const DEFAULT_BRANCH_ID = MOCK_COMPANIES[0].branches[0].id;

export function findBranch(
  companyId: string,
  branchId: string
): { company: MockCompany; branch: MockBranch } | null {
  const company = MOCK_COMPANIES.find((c) => c.id === companyId);
  if (!company) return null;
  const branch = company.branches.find((b) => b.id === branchId);
  if (!branch) return null;
  return { company, branch };
}

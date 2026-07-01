import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  GitBranch,
  Home,
  Settings,
  Shield,
  // TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export const BRAND = {
  primary: "#10B981",
  primaryDark: "#059669",
  accent: "#6366F1",
} as const;

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Permission required to see this tab (resource:action). Omit for all authenticated users. */
  permission?: string;
  /** Sidebar label when the logged-in user has the employee role */
  employeeTitle?: string;
}

export const MAIN_NAV: NavItem[] = [
  { title: "Dashboard", href: "/", icon: Home, permission: "dashboard:view" },
  { title: "Employees", href: "/employees", icon: Users, permission: "employee:view" },
  { title: "Attendance", href: "/attendance", icon: Clock, permission: "attendance:view", employeeTitle: "My Attendance" },
  { title: "Leave", href: "/leave", icon: Calendar, permission: "leave:view", employeeTitle: "My Leave" },
  { title: "Recruitment", href: "/recruitment", icon: Briefcase, permission: "recruitment:view" },
  // { title: "Performance", href: "/performance", icon: TrendingUp, permission: "performance:view" },
];

export const SETTINGS_NAV: NavItem[] = [
  { title: "Company Settings", href: "/settings/company", icon: Building2, permission: "company:view" },
  { title: "Branches", href: "/settings/branches", icon: GitBranch, permission: "branch:view" },
  { title: "Roles & Permissions", href: "/settings/roles", icon: Shield, permission: "user:view" },
  { title: "HR Settings", href: "/settings/hr", icon: Settings, permission: "company:view" },
];

/** Route prefix → required permission for page access */
export const ROUTE_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: "/employees", permission: "employee:view" },
  { prefix: "/attendance", permission: "attendance:view" },
  { prefix: "/leave", permission: "leave:view" },
  { prefix: "/recruitment", permission: "recruitment:view" },
  { prefix: "/performance", permission: "performance:view" },
  { prefix: "/documents", permission: "employee:view" },
  { prefix: "/notifications", permission: "notification:view" },
  { prefix: "/settings/company", permission: "company:view" },
  { prefix: "/settings/branches", permission: "branch:view" },
  { prefix: "/settings/roles", permission: "user:view" },
  { prefix: "/settings/hr", permission: "company:view" },
];

export function getRoutePermission(pathname: string): string | null {
  const match = ROUTE_PERMISSIONS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
  );
  return match?.permission ?? null;
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

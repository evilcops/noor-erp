import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  GitBranch,
  Home,
  Settings,
  Shield,
  TrendingUp,
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
}

export const MAIN_NAV: NavItem[] = [
  { title: "Dashboard", href: "/", icon: Home },
  { title: "Employees", href: "/employees", icon: Users },
  { title: "Attendance", href: "/attendance", icon: Clock },
  { title: "Leave", href: "/leave", icon: Calendar },
  { title: "Recruitment", href: "/recruitment", icon: Briefcase },
  { title: "Performance", href: "/performance", icon: TrendingUp },
];

export const SETTINGS_NAV: NavItem[] = [
  { title: "Company Settings", href: "/settings/company", icon: Building2 },
  { title: "Branches", href: "/settings/branches", icon: GitBranch },
  { title: "Roles & Permissions", href: "/settings/roles", icon: Shield },
  { title: "HR Settings", href: "/settings/hr", icon: Settings },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

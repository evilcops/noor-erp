import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Contact,
  GitBranch,
  Home,
  Layers,
  MapPin,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Truck,
  Warehouse,
  Bike,
  // TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { isRiderAllowedPath } from "@/config/modules";

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
  /** Only show this nav item when the user has one of these roles */
  roles?: import("@/types/auth-user").UserRole[];
}

export const MAIN_NAV: NavItem[] = [
  { title: "Dashboard", href: "/", icon: Home, permission: "dashboard:view" },
  { title: "Employees", href: "/employees", icon: Users, permission: "employee:view" },
  { title: "Attendance", href: "/attendance", icon: Clock, permission: "attendance:view", employeeTitle: "My Attendance" },
  { title: "Leave", href: "/leave", icon: Calendar, permission: "leave:view", employeeTitle: "My Leave" },
  { title: "Recruitment", href: "/recruitment", icon: Briefcase, permission: "recruitment:view" },
  // { title: "Performance", href: "/performance", icon: TrendingUp, permission: "performance:view" },
];

export const SUPPLY_NAV: NavItem[] = [
  { title: "Supply Dashboard", href: "/supply", icon: Warehouse, permission: "inventory:view" },
  { title: "Products", href: "/products", icon: Package, permission: "product:view" },
  { title: "Inventory", href: "/inventory", icon: Package, permission: "inventory:view" },
  { title: "Customers", href: "/customers", icon: Contact, permission: "customer:view" },
  { title: "Suppliers", href: "/suppliers", icon: Truck, permission: "supplier:view" },
  { title: "Purchase Orders", href: "/purchases", icon: ShoppingCart, permission: "purchase:view" },
  { title: "Stock Transfers", href: "/stock-transfers", icon: GitBranch, permission: "stock_transfer:view" },
];

export const RIDERS_NAV: NavItem[] = [
  { title: "Dispatch", href: "/dispatch", icon: MapPin, permission: "delivery:assign" },
  { title: "Deliveries", href: "/deliveries", icon: Package, permission: "delivery:assign" },
  { title: "Clusters", href: "/clusters", icon: Layers, permission: "delivery:assign" },
  { title: "Location", href: "/riders/location", icon: MapPin, permission: "rider:view" },
  { title: "Riders", href: "/riders", icon: Bike, permission: "rider:view" },
  {
    title: "My Deliveries",
    href: "/riders",
    icon: Bike,
    roles: ["rider"],
  },
];

export const SETTINGS_NAV: NavItem[] = [
  { title: "Company Settings", href: "/settings/company", icon: Building2, permission: "company:view" },
  { title: "Branches", href: "/settings/branches", icon: GitBranch, permission: "branch:view" },
  { title: "Roles & Permissions", href: "/settings/roles", icon: Shield, permission: "user:view" },
  { title: "HR Settings", href: "/settings/hr", icon: Settings, permission: "company:view" },
];

/** Route access: permission and/or role */
export interface RoutePermissionRule {
  prefix: string;
  permission?: string;
  roles?: import("@/types/auth-user").UserRole[];
}

export const ROUTE_PERMISSIONS: RoutePermissionRule[] = [
  { prefix: "/employees", permission: "employee:view" },
  { prefix: "/attendance", permission: "attendance:view" },
  { prefix: "/leave", permission: "leave:view" },
  { prefix: "/recruitment", permission: "recruitment:view" },
  { prefix: "/performance", permission: "performance:view" },
  { prefix: "/supply", permission: "inventory:view" },
  { prefix: "/products", permission: "product:view" },
  { prefix: "/inventory", permission: "inventory:view" },
  { prefix: "/customers", permission: "customer:view" },
  { prefix: "/suppliers", permission: "supplier:view" },
  { prefix: "/purchases", permission: "purchase:view" },
  { prefix: "/stock-transfers", permission: "stock_transfer:view" },
  { prefix: "/dispatch", permission: "delivery:assign" },
  { prefix: "/deliveries", permission: "delivery:assign" },
  { prefix: "/clusters", permission: "delivery:assign" },
  { prefix: "/riders/location", permission: "rider:view" },
  { prefix: "/riders", permission: "rider:view", roles: ["rider"] },
  { prefix: "/documents", permission: "employee:view" },
  { prefix: "/notifications", permission: "notification:view" },
  { prefix: "/settings/company", permission: "company:view" },
  { prefix: "/settings/branches", permission: "branch:view" },
  { prefix: "/settings/roles", permission: "user:view" },
  { prefix: "/settings/hr", permission: "company:view" },
];

export function getRoutePermissionRule(pathname: string): RoutePermissionRule | null {
  return (
    ROUTE_PERMISSIONS.find(
      (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
    ) ?? null
  );
}

/** @deprecated use getRoutePermissionRule */
export function getRoutePermission(pathname: string): string | null {
  return getRoutePermissionRule(pathname)?.permission ?? null;
}

export function canAccessRoute(
  pathname: string,
  can: (permission: string) => boolean,
  userRole?: import("@/types/auth-user").UserRole
): boolean {
  if (userRole === "rider") {
    return isRiderAllowedPath(pathname);
  }

  const rule = getRoutePermissionRule(pathname);
  if (!rule) return true;
  if (rule.roles?.length && userRole && rule.roles.includes(userRole)) return true;
  if (rule.permission && can(rule.permission)) return true;
  return false;
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Prefer the most specific nav href when several items match (e.g. /riders/location vs /riders). */
export function getActiveNavHref(pathname: string, hrefs: string[]): string | null {
  const sorted = [...hrefs].sort((a, b) => b.length - a.length);
  for (const href of sorted) {
    if (isNavActive(pathname, href)) return href;
  }
  return null;
}

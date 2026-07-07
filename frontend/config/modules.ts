export type ErpModule = "hr" | "inventory" | "riders";

export const ERP_MODULE_STORAGE_KEY = "noor_erp_module";

const HR_ROUTE_PREFIXES = [
  "/",
  "/employees",
  "/attendance",
  "/leave",
  "/recruitment",
  "/performance",
  "/documents",
];

const INVENTORY_ROUTE_PREFIXES = [
  "/supply",
  "/products",
  "/inventory",
  "/customers",
  "/suppliers",
  "/purchases",
  "/stock-transfers",
];

const RIDERS_ROUTE_PREFIXES = [
  "/riders",
  "/dispatch",
  "/deliveries",
  "/clusters",
];

export function isHrRoute(pathname: string): boolean {
  return HR_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || (prefix !== "/" && pathname.startsWith(`${prefix}/`))
  );
}

export function isInventoryRoute(pathname: string): boolean {
  return INVENTORY_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isRidersRoute(pathname: string): boolean {
  return RIDERS_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getModuleFromPathname(pathname: string): ErpModule | null {
  if (isRidersRoute(pathname)) return "riders";
  if (isInventoryRoute(pathname)) return "inventory";
  if (isHrRoute(pathname)) return "hr";
  return null;
}

export function getModuleDefaultPath(module: ErpModule, role?: string): string {
  if (module === "inventory") return "/supply";
  if (module === "riders") return role === "rider" ? "/riders" : "/dispatch";
  return role === "rider" ? "/riders" : "/";
}

/** Paths a rider account may access (last-mile workspace only). */
export function isRiderAllowedPath(pathname: string): boolean {
  return (
    pathname === "/riders" ||
    pathname.startsWith("/riders/") ||
    pathname === "/notifications" ||
    pathname.startsWith("/notifications/")
  );
}

export function getDefaultHomePath(role?: string): string {
  if (role === "rider") return "/riders";
  return "/";
}

export const MODULE_LABELS: Record<ErpModule, string> = {
  hr: "HR",
  inventory: "Inventory",
  riders: "Riders",
};

export const MODULE_SIDEBAR_LABELS: Record<ErpModule, string> = {
  hr: "People",
  inventory: "Supply Chain",
  riders: "Last Mile",
};

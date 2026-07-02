export type ErpModule = "hr" | "inventory";

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

export function getModuleFromPathname(pathname: string): ErpModule | null {
  if (isInventoryRoute(pathname)) return "inventory";
  if (isHrRoute(pathname)) return "hr";
  return null;
}

export function getModuleDefaultPath(module: ErpModule): string {
  return module === "inventory" ? "/supply" : "/";
}

export const MODULE_LABELS: Record<ErpModule, string> = {
  hr: "HR",
  inventory: "Inventory",
};

export const MODULE_SIDEBAR_LABELS: Record<ErpModule, string> = {
  hr: "People",
  inventory: "Supply Chain",
};

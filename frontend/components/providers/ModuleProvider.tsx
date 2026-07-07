"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks";
import {
  ERP_MODULE_STORAGE_KEY,
  getModuleDefaultPath,
  getModuleFromPathname,
  isRiderAllowedPath,
  type ErpModule,
} from "@/config/modules";
import { isRiderRole } from "@/lib/permissions";

interface ModuleContextValue {
  activeModule: ErpModule;
  setActiveModule: (module: ErpModule) => void;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

function readStoredModule(): ErpModule {
  if (typeof window === "undefined") return "hr";
  const stored = localStorage.getItem(ERP_MODULE_STORAGE_KEY);
  if (stored === "inventory") return "inventory";
  if (stored === "riders") return "riders";
  return "hr";
}

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [activeModule, setActiveModuleState] = useState<ErpModule>("hr");

  useEffect(() => {
    if (isRiderRole(user)) {
      setActiveModuleState("riders");
      localStorage.setItem(ERP_MODULE_STORAGE_KEY, "riders");
      if (!isRiderAllowedPath(pathname)) {
        router.replace("/riders");
      }
      return;
    }

    const fromPath = getModuleFromPathname(pathname);
    if (fromPath) {
      setActiveModuleState(fromPath);
      localStorage.setItem(ERP_MODULE_STORAGE_KEY, fromPath);
      return;
    }
    setActiveModuleState(readStoredModule());
  }, [pathname, user, router]);

  const setActiveModule = useCallback(
    (module: ErpModule) => {
      if (isRiderRole(user) && module !== "riders") return;
      setActiveModuleState(module);
      localStorage.setItem(ERP_MODULE_STORAGE_KEY, module);
      router.push(getModuleDefaultPath(module, user?.role));
    },
    [router, user?.role, user]
  );

  const value = useMemo(
    () => ({ activeModule, setActiveModule }),
    [activeModule, setActiveModule]
  );

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
}

export function useErpModule() {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error("useErpModule must be used within ModuleProvider");
  return ctx;
}

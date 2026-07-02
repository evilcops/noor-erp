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
import {
  ERP_MODULE_STORAGE_KEY,
  getModuleDefaultPath,
  getModuleFromPathname,
  type ErpModule,
} from "@/config/modules";

interface ModuleContextValue {
  activeModule: ErpModule;
  setActiveModule: (module: ErpModule) => void;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

function readStoredModule(): ErpModule {
  if (typeof window === "undefined") return "hr";
  const stored = localStorage.getItem(ERP_MODULE_STORAGE_KEY);
  return stored === "inventory" ? "inventory" : "hr";
}

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeModule, setActiveModuleState] = useState<ErpModule>("hr");

  useEffect(() => {
    const fromPath = getModuleFromPathname(pathname);
    if (fromPath) {
      setActiveModuleState(fromPath);
      localStorage.setItem(ERP_MODULE_STORAGE_KEY, fromPath);
      return;
    }
    setActiveModuleState(readStoredModule());
  }, [pathname]);

  const setActiveModule = useCallback(
    (module: ErpModule) => {
      setActiveModuleState(module);
      localStorage.setItem(ERP_MODULE_STORAGE_KEY, module);
      router.push(getModuleDefaultPath(module));
    },
    [router]
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

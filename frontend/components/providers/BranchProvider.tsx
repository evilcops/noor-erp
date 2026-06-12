"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { branchApi, type Branch } from "@/lib/api/branches";

interface BranchContextValue {
  branches: Branch[];
  activeBranchId: string | null;
  setActiveBranchId: (id: string) => void;
  isLoading: boolean;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextValue | null>(null);
const STORAGE_KEY = "noor_active_branch";

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setActiveBranchId = useCallback((id: string) => {
    setActiveBranchIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refreshBranches = useCallback(async () => {
    if (!user) {
      setBranches([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await branchApi.getAll({
        companyId: user.companyId || undefined,
        limit: 100,
      });
      setBranches(data);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && data.some((b) => b._id === stored)) {
        setActiveBranchIdState(stored);
      } else if (data.length) {
        const defaultId = user.branchId && data.some((b) => b._id === user.branchId)
          ? user.branchId
          : data[0]._id;
        setActiveBranchIdState(defaultId);
        localStorage.setItem(STORAGE_KEY, defaultId);
      }
    } catch {
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshBranches();
  }, [refreshBranches]);

  const value = useMemo(
    () => ({
      branches,
      activeBranchId,
      setActiveBranchId,
      isLoading,
      refreshBranches,
    }),
    [branches, activeBranchId, setActiveBranchId, isLoading, refreshBranches]
  );

  return (
    <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error("useBranch must be used within BranchProvider");
  }
  return context;
}

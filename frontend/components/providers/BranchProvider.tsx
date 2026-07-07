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
import {
  effectiveBranchId,
  formatBranchLabel,
  getParentBranchId,
  mainBranches,
  resolveMainAndSubBranchId,
  subBranchesOf,
} from "@/lib/branch-utils";

interface BranchContextValue {
  branches: Branch[];
  mainBranches: Branch[];
  activeMainBranchId: string | null;
  activeSubBranchId: string | null;
  /** Resolved branch for API calls (sub-branch if selected, else main) */
  activeBranchId: string | null;
  activeSubBranches: Branch[];
  setActiveMainBranchId: (id: string) => void;
  setActiveSubBranchId: (id: string) => void;
  /** @deprecated use setActiveMainBranchId / setActiveSubBranchId */
  setActiveBranchId: (id: string) => void;
  formatLabel: (branch: Branch) => string;
  isLoading: boolean;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextValue | null>(null);
const STORAGE_KEY_MAIN = "noor_active_main_branch";
const STORAGE_KEY_SUB = "noor_active_sub_branch";
const STORAGE_KEY_LEGACY = "noor_active_branch";

function persistSelection(mainId: string | null, subId: string | null) {
  if (mainId) localStorage.setItem(STORAGE_KEY_MAIN, mainId);
  else localStorage.removeItem(STORAGE_KEY_MAIN);
  if (subId) localStorage.setItem(STORAGE_KEY_SUB, subId);
  else localStorage.removeItem(STORAGE_KEY_SUB);
  const effective = effectiveBranchId(mainId ?? "", subId ?? "");
  if (effective) localStorage.setItem(STORAGE_KEY_LEGACY, effective);
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeMainBranchId, setActiveMainBranchIdState] = useState<string | null>(null);
  const [activeSubBranchId, setActiveSubBranchIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setActiveMainBranchId = useCallback((id: string) => {
    setActiveMainBranchIdState(id);
    setActiveSubBranchIdState(null);
    persistSelection(id, null);
  }, []);

  const setActiveSubBranchId = useCallback((id: string) => {
    setActiveSubBranchIdState(id || null);
  }, []);

  useEffect(() => {
    if (activeMainBranchId) {
      persistSelection(activeMainBranchId, activeSubBranchId);
    }
  }, [activeMainBranchId, activeSubBranchId]);

  const setActiveBranchId = useCallback(
    (id: string) => {
      const { mainId, subId } = resolveMainAndSubBranchId(id, branches);
      if (!mainId) return;
      setActiveMainBranchIdState(mainId);
      setActiveSubBranchIdState(subId || null);
      persistSelection(mainId, subId || null);
    },
    [branches]
  );

  const refreshBranches = useCallback(async () => {
    if (!user) {
      setBranches([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await branchApi.getAll({
        companyId: user.companyId || undefined,
        limit: 200,
      });
      setBranches(data);

      const storedMain = localStorage.getItem(STORAGE_KEY_MAIN);
      const storedSub = localStorage.getItem(STORAGE_KEY_SUB);
      const storedLegacy = localStorage.getItem(STORAGE_KEY_LEGACY);

      let mainId: string | null = null;
      let subId: string | null = null;

      if (storedMain && data.some((b) => b._id === storedMain)) {
        mainId = storedMain;
        if (storedSub && data.some((b) => b._id === storedSub)) {
          const sub = data.find((b) => b._id === storedSub);
          if (sub && getParentBranchId(sub) === mainId) {
            subId = storedSub;
          }
        }
      } else if (storedLegacy && data.some((b) => b._id === storedLegacy)) {
        const resolved = resolveMainAndSubBranchId(storedLegacy, data);
        mainId = resolved.mainId || null;
        subId = resolved.subId || null;
      } else if (user.branchId && data.some((b) => b._id === user.branchId)) {
        const resolved = resolveMainAndSubBranchId(user.branchId, data);
        mainId = resolved.mainId || null;
        subId = resolved.subId || null;
      } else {
        const firstMain = mainBranches(data)[0];
        mainId = firstMain?._id ?? data[0]?._id ?? null;
        subId = null;
      }

      setActiveMainBranchIdState(mainId);
      setActiveSubBranchIdState(subId);
      if (mainId) persistSelection(mainId, subId);
    } catch {
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshBranches();
  }, [refreshBranches]);

  const activeBranchId = useMemo(
    () =>
      activeMainBranchId
        ? effectiveBranchId(activeMainBranchId, activeSubBranchId ?? "") || activeMainBranchId
        : null,
    [activeMainBranchId, activeSubBranchId]
  );

  const activeSubBranches = useMemo(
    () => (activeMainBranchId ? subBranchesOf(branches, activeMainBranchId) : []),
    [branches, activeMainBranchId]
  );

  const value = useMemo(
    () => ({
      branches,
      mainBranches: mainBranches(branches),
      activeMainBranchId,
      activeSubBranchId,
      activeBranchId,
      activeSubBranches,
      setActiveMainBranchId,
      setActiveSubBranchId,
      setActiveBranchId,
      formatLabel: (branch: Branch) => formatBranchLabel(branch, branches),
      isLoading,
      refreshBranches,
    }),
    [
      branches,
      activeMainBranchId,
      activeSubBranchId,
      activeBranchId,
      activeSubBranches,
      setActiveMainBranchId,
      setActiveSubBranchId,
      setActiveBranchId,
      isLoading,
      refreshBranches,
    ]
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error("useBranch must be used within BranchProvider");
  }
  return context;
}

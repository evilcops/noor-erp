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
import { clearTokens, getAccessToken, setTokens } from "@/lib/api/token";
import { storeApi, type StoreAuthUser, type StoreBranch, type StoreCustomer } from "@/lib/api/store";
import { getStoredLocation, setStoredLocation, type StoredLocation } from "@/lib/location";

interface StoreAuthContextValue {
  user: StoreAuthUser | null;
  customer: StoreCustomer | null;
  branch: StoreBranch | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    address?: string;
    area?: string;
    branchId?: string;
    coordinates?: { lat: number; lng: number };
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const StoreAuthContext = createContext<StoreAuthContextValue | null>(null);

function syncBranchToLocation(branch: StoreBranch | null | undefined, customer?: StoreCustomer | null) {
  if (!branch) return;
  const existing = getStoredLocation();
  const lat = customer?.coordinates?.lat;
  const lng = customer?.coordinates?.lng;
  const hasPin = lat != null && lng != null;
  if (existing?.branchId === branch._id && existing.inService && hasPin) return;
  const next: StoredLocation = {
    branchId: branch._id,
    branchName: branch.name,
    branchCode: branch.code,
    branchAddress: branch.address,
    address: customer?.address || existing?.address,
    lat,
    lng,
    distanceKm: branch.distanceKm,
    inService: Boolean(hasPin && customer?.branchId === branch._id),
    updatedAt: new Date().toISOString(),
  };
  setStoredLocation(next);
}

export function StoreAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoreAuthUser | null>(null);
  const [customer, setCustomer] = useState<StoreCustomer | null>(null);
  const [branch, setBranch] = useState<StoreBranch | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setCustomer(null);
      setBranch(null);
      setLoading(false);
      return;
    }
    try {
      const me = await storeApi.me();
      if (me.user.role !== "customer") {
        setUser(null);
        setCustomer(null);
        setBranch(null);
        return;
      }
      setUser(me.user);
      setCustomer(me.customer);
      setBranch(me.branch ?? null);
      syncBranchToLocation(me.branch, me.customer);
    } catch {
      setUser(null);
      setCustomer(null);
      setBranch(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await storeApi.login({ email, password });
    setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
    setCustomer(result.customer);
    setBranch(result.branch ?? null);
    syncBranchToLocation(result.branch, result.customer);
  }, []);

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      phone: string;
      password: string;
      address?: string;
      area?: string;
      branchId?: string;
      coordinates?: { lat: number; lng: number };
    }) => {
      const result = await storeApi.register(data);
      setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      setCustomer(result.customer);
      setBranch(result.branch ?? null);
      syncBranchToLocation(result.branch, result.customer);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await storeApi.logout();
    } catch {
      // ignore
    }
    clearTokens();
    setUser(null);
    setCustomer(null);
    setBranch(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      customer,
      branch,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refresh,
    }),
    [user, customer, branch, loading, login, register, logout, refresh]
  );

  return <StoreAuthContext.Provider value={value}>{children}</StoreAuthContext.Provider>;
}

export function useStoreAuth() {
  const ctx = useContext(StoreAuthContext);
  if (!ctx) throw new Error("useStoreAuth must be used within StoreAuthProvider");
  return ctx;
}

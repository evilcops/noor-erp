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
import { storeApi, type StoreAuthUser, type StoreCustomer } from "@/lib/api/store";

interface StoreAuthContextValue {
  user: StoreAuthUser | null;
  customer: StoreCustomer | null;
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
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const StoreAuthContext = createContext<StoreAuthContextValue | null>(null);

export function StoreAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoreAuthUser | null>(null);
  const [customer, setCustomer] = useState<StoreCustomer | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setCustomer(null);
      setLoading(false);
      return;
    }
    try {
      const me = await storeApi.me();
      if (me.user.role !== "customer") {
        setUser(null);
        setCustomer(null);
        return;
      }
      setUser(me.user);
      setCustomer(me.customer);
    } catch {
      setUser(null);
      setCustomer(null);
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
  }, []);

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      phone: string;
      password: string;
      address?: string;
      area?: string;
    }) => {
      const result = await storeApi.register(data);
      setTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      setCustomer(result.customer);
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
  }, []);

  const value = useMemo(
    () => ({
      user,
      customer,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refresh,
    }),
    [user, customer, loading, login, register, logout, refresh]
  );

  return <StoreAuthContext.Provider value={value}>{children}</StoreAuthContext.Provider>;
}

export function useStoreAuth() {
  const ctx = useContext(StoreAuthContext);
  if (!ctx) throw new Error("useStoreAuth must be used within StoreAuthProvider");
  return ctx;
}

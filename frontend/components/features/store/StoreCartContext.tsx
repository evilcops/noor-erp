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

export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  availableStock: number;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
}

const CART_KEY = "noor_store_cart";
const CartContext = createContext<CartContextValue | null>(null);

export function StoreCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      setItems([]);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((row) => row.productId === item.productId);
      if (existing) {
        return prev.map((row) =>
          row.productId === item.productId
            ? {
                ...row,
                ...item,
                quantity: Math.min(row.availableStock || item.availableStock, row.quantity + qty),
              }
            : row
        );
      }
      return [...prev, { ...item, quantity: Math.min(Math.max(1, qty), item.availableStock || qty) }];
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((row) =>
          row.productId === productId
            ? { ...row, quantity: Math.min(Math.max(0, quantity), row.availableStock || quantity) }
            : row
        )
        .filter((row) => row.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((row) => row.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const itemCount = items.reduce((sum, row) => sum + row.quantity, 0);
    const subtotal = items.reduce((sum, row) => sum + row.quantity * row.unitPrice, 0);
    return { items, itemCount, subtotal, addItem, setQuantity, removeItem, clear };
  }, [items, addItem, setQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useStoreCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useStoreCart must be used within StoreCartProvider");
  return ctx;
}

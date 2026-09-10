"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  variant?: string; // chosen option value (Slice 7); absent = plain product
};

// A line's identity is product+variant: S and M of one shirt are two
// lines. Legacy stored carts have no variant field — undefined matches
// undefined, so they load and behave unchanged.
const sameLine = (x: CartItem, productId: string, variant?: string) =>
  x.productId === productId && x.variant === variant;

// The render key for a cart line — the one encoding of its identity
// (mirrors the backend's product::variant line key).
export const lineKey = (x: Pick<CartItem, "productId" | "variant">) =>
  `${x.productId}::${x.variant ?? ""}`;

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  removeItem: (productId: string, variant?: string) => void;
  updateQty: (productId: string, qty: number, variant?: string) => void;
  clearCart: () => void;
  total: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "cart_items_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load cart from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setItems(JSON.parse(raw));
      } catch {
        setItems([]);
      }
    }
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem: CartContextType["addItem"] = (item, qty = 1) => {
    setItems((prev) => {
      const next = [...prev];
      const existing = next.find((x) => sameLine(x, item.productId, item.variant));
      if (existing) {
        existing.quantity += qty;
      } else {
        next.push({ ...item, quantity: qty });
      }
      return next;
    });
  };

  const removeItem = (productId: string, variant?: string) => {
    setItems((prev) => prev.filter((x) => !sameLine(x, productId, variant)));
  };

  const updateQty = (productId: string, qty: number, variant?: string) => {
    setItems((prev) =>
      prev.map((x) =>
        sameLine(x, productId, variant) ? { ...x, quantity: Math.max(1, qty) } : x
      )
    );
  };

  const clearCart = () => setItems([]);

  const total = useMemo(
    () => items.reduce((sum, x) => sum + x.price * x.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({ items, addItem, removeItem, updateQty, clearCart, total }),
    [items, total]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

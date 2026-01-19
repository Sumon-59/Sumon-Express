"use client";

import React from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function CartPage() {
  const { items, total, removeItem, updateQty, clearCart } = useCart();

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <h2>Cart</h2>

      {items.length === 0 ? (
        <p>
          Cart is empty. <Link href="/products">Go to products</Link>
        </p>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {items.map((x) => (
              <div
                key={x.productId}
                style={{ border: "1px solid #ddd", padding: 12, borderRadius: 10 }}
              >
                <div style={{ fontWeight: 700 }}>{x.name}</div>
                <div style={{ marginTop: 4 }}>৳{x.price}</div>

                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <label>Qty:</label>
                  <input
                    type="number"
                    min={1}
                    value={x.quantity}
                    onChange={(e) => updateQty(x.productId, Number(e.target.value))}
                    style={{ width: 70 }}
                  />
                  <button onClick={() => removeItem(x.productId)}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 16 }}>Total: ৳{total}</h3>

          <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
            <Link href="/products">← Continue shopping</Link>
            <Link href="/checkout">Go to Checkout →</Link>
            <button onClick={clearCart}>Clear Cart</button>
          </div>
        </>
      )}
    </div>
  );
}

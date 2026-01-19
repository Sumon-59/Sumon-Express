"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const { user, loading } = useAuth();

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Simple guard: must be logged in
  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const placeOrder = async () => {
    if (items.length === 0) return;

    try {
      setSubmitting(true);
      setError(null);

      // Adjust payload if your backend expects different keys
      const payload = {
        items: items.map((x) => ({
            product: x.productId,
            quantity: x.quantity,
        })),
        totalPrice: total,
    };


      await api.post("/orders", payload);

      clearCart();
      router.push("/orders");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to place order";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <h2>Checkout</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {items.length === 0 ? (
        <p>
          Cart is empty. <Link href="/products">Go to products</Link>
        </p>
      ) : (
        <>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {items.map((x) => (
              <div
                key={x.productId}
                style={{ border: "1px solid #ddd", padding: 12, borderRadius: 10 }}
              >
                <div style={{ fontWeight: 700 }}>{x.name}</div>
                <div>৳{x.price} × {x.quantity}</div>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: 16 }}>Total: ৳{total}</h3>

          <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
            <Link href="/cart">← Back to cart</Link>

            <button
              onClick={placeOrder}
              disabled={submitting}
              style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #111" }}
            >
              {submitting ? "Placing order..." : "Place Order"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

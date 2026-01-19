"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

type Order = {
  _id: string;
  status?: string;
  createdAt?: string;
  totalPrice?: number;
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [fetching, setFetching] = React.useState(true);

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const fetchOrders = async () => {
    try {
      setFetching(true);
      setError(null);

      // If your backend uses a different route, change ONLY this line:
      const res = await api.get("/orders/my-orders");

      const list: Order[] = res.data?.orders ?? res.data ?? [];
      setOrders(Array.isArray(list) ? list : []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to load orders";
      setError(msg);
      setOrders([]);
    } finally {
      setFetching(false);
    }
  };

  React.useEffect(() => {
    if (!user) return;
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>My Orders</h2>
        <Link href="/products">Products</Link>
      </div>

      {fetching && <p>Loading orders...</p>}
      {error && (
        <div>
          <p style={{ color: "red" }}>{error}</p>
          <button onClick={fetchOrders}>Retry</button>
        </div>
      )}

      {!fetching && !error && orders.length === 0 && <p>No orders found.</p>}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {orders.map((o) => (
          <div key={o._id} style={{ border: "1px solid #ddd", padding: 12, borderRadius: 10 }}>
            <div style={{ fontWeight: 700 }}>Order ID: {o._id}</div>
            <div>Status: {o.status ?? "N/A"}</div>
            <div>Date: {o.createdAt ? new Date(o.createdAt).toLocaleString() : "N/A"}</div>
            <div>Total: {typeof o.totalPrice === "number" ? `৳${o.totalPrice}` : "N/A"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

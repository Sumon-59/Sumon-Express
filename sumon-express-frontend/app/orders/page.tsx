"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackageOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatTaka } from "@/types/product";

type OrderItem = {
  product: string;
  name: string;
  price: number;
  quantity: number;
};

type Order = {
  _id: string;
  status: string;
  createdAt?: string;
  totalPrice: number;
  items?: OrderItem[];
  shippingAddress?: { address?: string; city?: string; phone?: string };
  paymentMethod?: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  processing: "bg-blue-100 text-blue-800 border-blue-200",
  shipped: "bg-violet-100 text-violet-800 border-violet-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [fetching, setFetching] = React.useState(true);
  const [cancelling, setCancelling] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const fetchOrders = React.useCallback(async () => {
    try {
      setFetching(true);
      setError(null);
      const res = await api.get("/orders/my-orders");
      const list: Order[] = res.data?.orders ?? res.data ?? [];
      setOrders(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load orders");
      setOrders([]);
    } finally {
      setFetching(false);
    }
  }, []);

  React.useEffect(() => {
    if (user) fetchOrders();
  }, [user?._id, fetchOrders]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelOrder = async (id: string) => {
    if (!window.confirm("Cancel this order? Stock will be restored.")) return;
    try {
      setCancelling(id);
      await api.put(`/orders/${id}/cancel`);
      await fetchOrders();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to cancel order");
    } finally {
      setCancelling(null);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Orders</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/products">Shop More</Link>
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}{" "}
          <button onClick={fetchOrders} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      {fetching ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : !error && orders.length === 0 ? (
        <div className="mt-20 text-center">
          <PackageOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 font-semibold">No orders yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When you place an order, it will show up here.
          </p>
          <Button asChild className="mt-6">
            <Link href="/products">Start Shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((o) => {
            const canCancel = ["pending", "processing"].includes(o.status);
            return (
              <div key={o._id} className="rounded-lg border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">#{o._id}</p>
                    <p className="text-sm text-muted-foreground">
                      {o.createdAt
                        ? new Date(o.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`capitalize ${STATUS_STYLES[o.status] ?? ""}`}
                  >
                    {o.status}
                  </Badge>
                </div>

                {o.items && o.items.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <div className="space-y-1.5">
                      {o.items.map((item, i) => (
                        <div key={i} className="flex justify-between gap-4 text-sm">
                          <span className="min-w-0 truncate">
                            {item.name}{" "}
                            <span className="text-muted-foreground">× {item.quantity}</span>
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {formatTaka(item.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <Separator className="my-3" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {o.shippingAddress?.address && (
                      <p>
                        Deliver to: {o.shippingAddress.address}
                        {o.shippingAddress.city ? `, ${o.shippingAddress.city}` : ""}
                      </p>
                    )}
                    <p className="uppercase">{o.paymentMethod ?? "cod"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums text-primary">
                      {formatTaka(o.totalPrice)}
                    </span>
                    {canCancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                        disabled={cancelling === o._id}
                        onClick={() => cancelOrder(o._id)}
                      >
                        {cancelling === o._id ? "Cancelling…" : "Cancel Order"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

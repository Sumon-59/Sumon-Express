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
import {
  STATUS_STYLES,
  OrderStatus,
  OrderItem,
  OrderPayment,
  paymentBadge,
} from "@/types/order";
import { lineLabel } from "@/lib/format";

type Order = {
  _id: string;
  status: string;
  createdAt?: string;
  totalPrice: number;
  discount?: { code: string; amount: number };
  items?: OrderItem[];
  shippingAddress?: { address?: string; city?: string; phone?: string };
  paymentMethod?: string;
  isPaid?: boolean;
  payment?: OrderPayment;
};

// The gateway return notice (?paid=…). The success wording is honest:
// paid-ness comes from the verified webhook, which may land seconds
// after the browser does — the refetch shows whatever is true now.
const RETURN_NOTICES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  success: {
    text: "Confirming your payment with the gateway — your order will show as Paid within moments.",
    tone: "ok",
  },
  fail: { text: "The payment didn't go through. You can try again below.", tone: "warn" },
  cancel: { text: "Payment cancelled. You can try again below.", tone: "warn" },
  "init-failed": {
    text: "Your order was placed, but the payment gateway could not be reached. Use Pay Now to try again.",
    tone: "warn",
  },
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [orders, setOrders] = React.useState<Order[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [fetching, setFetching] = React.useState(true);
  const [cancelling, setCancelling] = React.useState<string | null>(null);
  const [paying, setPaying] = React.useState<string | null>(null);
  const [returnNotice, setReturnNotice] = React.useState<
    { text: string; tone: "ok" | "warn" } | null
  >(null);

  // Read the gateway return query straight off the URL (no Suspense
  // dance) and clean it up so a refresh doesn't repeat the notice.
  const [highlightId, setHighlightId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("paid");
    if (outcome && RETURN_NOTICES[outcome]) {
      setReturnNotice(RETURN_NOTICES[outcome]);
      setHighlightId(params.get("order"));
      window.history.replaceState(null, "", "/orders");
    }
  }, []);

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

  // Retry an online payment: fresh gateway session, same order.
  const payNow = async (id: string) => {
    try {
      setPaying(id);
      const { data } = await api.post("/payments/init", { orderId: id });
      window.location.assign(data.redirectUrl);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to start payment");
      setPaying(null);
    }
  };

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

      {returnNotice && (
        <div
          className={`mt-4 rounded-md border p-3 text-sm ${
            returnNotice.tone === "ok"
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-amber-300 bg-amber-50 text-amber-800"
          }`}
        >
          {returnNotice.text}
        </div>
      )}

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
              <div
                key={o._id}
                className={`rounded-lg border bg-card p-5 ${
                  highlightId === o._id ? "ring-2 ring-primary" : ""
                }`}
              >
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
                  <div className="flex items-center gap-2">
                    {(() => {
                      const badge = paymentBadge(o);
                      return badge ? (
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      ) : null;
                    })()}
                    <Badge
                      variant="outline"
                      className={`capitalize ${STATUS_STYLES[o.status as OrderStatus] ?? ""}`}
                    >
                      {o.status}
                    </Badge>
                  </div>
                </div>

                {o.items && o.items.length > 0 && (
                  <>
                    <Separator className="my-3" />
                    <div className="space-y-1.5">
                      {o.items.map((item, i) => (
                        <div key={i} className="flex justify-between gap-4 text-sm">
                          <span className="min-w-0 truncate">
                            {lineLabel(item.name, item.variantName)}{" "}
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
                    {o.discount && (
                      <span className="text-sm text-green-600">
                        {o.discount.code} −{formatTaka(o.discount.amount)}
                      </span>
                    )}
                    <span className="font-semibold tabular-nums text-primary">
                      {formatTaka(o.totalPrice)}
                    </span>
                    {o.paymentMethod === "online" && !o.isPaid && o.status === "pending" && (
                      <Button
                        size="sm"
                        disabled={paying === o._id}
                        onClick={() => payNow(o._id)}
                      >
                        {paying === o._id ? "Starting…" : "Pay Now"}
                      </Button>
                    )}
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

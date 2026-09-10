"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import OrderStatusActions from "@/components/admin/OrderStatusActions";
import { formatTaka } from "@/types/product";
import {
  AdminOrder,
  OrderListResponse,
  OrderStatus,
  STATUS_STYLES,
} from "@/types/order";

type StatusFilter = "all" | OrderStatus;

const STATUS_OPTIONS: StatusFilter[] = [
  "all",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

import { formatDate } from "@/lib/format";

// Wrapped so useSearchParams (the customer-page deep link) doesn't
// force a client-side bailout of the whole route at build time.
export default function AdminOrdersPage() {
  return (
    <React.Suspense>
      <AdminOrdersPageInner />
    </React.Suspense>
  );
}

function AdminOrdersPageInner() {
  // Deep-link support: /admin/orders?user=<id>&open=<orderId> arrives
  // from a customer's order-history row (Slice 4).
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [page, setPage] = React.useState(1);
  const [userFilter, setUserFilter] = React.useState<string | null>(
    () => searchParams.get("user")
  );

  const [data, setData] = React.useState<OrderListResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(
    () => searchParams.get("open")
  );

  const fetchList = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (status !== "all") params.set("status", status);
      if (userFilter) params.set("user", userFilter);
      const res = await api.get<OrderListResponse>(`/admin/orders?${params}`);
      setData(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load orders"));
    } finally {
      setLoading(false);
    }
  }, [page, status, userFilter]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  // The drawer renders from the row the listing already returned — the
  // items snapshot lives on the order, so no second request is needed.
  const selectedOrder = data?.orders.find((o) => o._id === openId) ?? null;

  const advance = async (order: AdminOrder, next: OrderStatus) => {
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await api.put(`/admin/orders/${order._id}`, { status: next });
      // Under a status filter the order leaves this list (and the drawer
      // closes with it) — the notice says what happened.
      setNotice(`Order #${order._id.slice(-8)} marked ${next}`);
      await fetchList();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update status"));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (order: AdminOrder) => {
    if (
      !window.confirm(
        `Cancel this order (${formatTaka(order.totalPrice)})? Its stock goes back on the shelf.`
      )
    )
      return;
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await api.put(`/admin/orders/${order._id}/cancel`);
      setNotice(`Order #${order._id.slice(-8)} cancelled — stock restored`);
      await fetchList();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to cancel order"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Orders</h1>
          {data && (
            <p className="text-sm text-muted-foreground">
              {data.total} order{data.total === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setOpenId(null);
            setStatus(e.target.value as StatusFilter);
          }}
          aria-label="Filter by status"
          className="h-9 rounded-md border bg-card px-3 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>
      </div>

      {userFilter && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-sm">
          Showing one customer&apos;s orders
          <button
            type="button"
            aria-label="Show all orders"
            onClick={() => {
              setUserFilter(null);
              setPage(1);
            }}
            className="text-muted-foreground transition-colors hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : !data || data.orders.length === 0 ? (
        <div className="mt-8 rounded-lg border bg-card p-10 text-center text-muted-foreground">
          No orders match.
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium">Customer</th>
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Items</th>
                  <th className="p-3 font-medium">Total</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr
                    key={o._id}
                    onClick={() => setOpenId(o._id)}
                    className={`cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50 ${
                      openId === o._id ? "bg-accent/50" : ""
                    }`}
                  >
                    <td className="p-3">
                      <span className="font-medium">{o.user?.name ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {o.user?.email}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                    <td className="p-3 tabular-nums">
                      {o.items.reduce((n, it) => n + it.quantity, 0)}
                    </td>
                    <td className="p-3 tabular-nums">{formatTaka(o.totalPrice)}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={`capitalize ${STATUS_STYLES[o.status]}`}>
                        {o.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((n) => n - 1)}
              >
                Prev
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                Page {page} of {data.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pages}
                onClick={() => setPage((n) => n + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-40" role="dialog" aria-label="Order details">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpenId(null)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">Order details</h2>
                <p className="text-xs text-muted-foreground">
                  #{selectedOrder._id.slice(-8)} · {formatDate(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close details"
                onClick={() => setOpenId(null)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Badge variant="outline" className={`capitalize ${STATUS_STYLES[selectedOrder.status]}`}>
                {selectedOrder.status}
              </Badge>
              {selectedOrder.isPaid && (
                <Badge variant="outline" className="border-green-200 bg-green-100 text-green-800">
                  Paid
                </Badge>
              )}
            </div>

            <Separator className="my-4" />

            <h3 className="text-sm font-medium">Items</h3>
            <ul className="mt-2 space-y-2">
              {selectedOrder.items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {it.name} <span className="text-muted-foreground">× {it.quantity}</span>
                  </span>
                  <span className="tabular-nums">{formatTaka(it.price * it.quantity)}</span>
                </li>
              ))}
            </ul>
            {selectedOrder.discount && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Discount ({selectedOrder.discount.code})
                </span>
                <span className="tabular-nums text-green-600">
                  −{formatTaka(selectedOrder.discount.amount)}
                </span>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatTaka(selectedOrder.totalPrice)}</span>
            </div>

            <Separator className="my-4" />

            <h3 className="text-sm font-medium">Customer</h3>
            <p className="mt-1 text-sm">{selectedOrder.user?.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{selectedOrder.user?.email}</p>

            <h3 className="mt-4 text-sm font-medium">Shipping</h3>
            <p className="mt-1 text-sm">
              {selectedOrder.shippingAddress?.address ?? "—"}
              {selectedOrder.shippingAddress?.city ? `, ${selectedOrder.shippingAddress.city}` : ""}
            </p>
            {selectedOrder.shippingAddress?.phone && (
              <p className="text-sm text-muted-foreground">{selectedOrder.shippingAddress.phone}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground uppercase">
              {selectedOrder.paymentMethod ?? ""}
            </p>

            <Separator className="my-4" />

            <h3 className="mb-2 text-sm font-medium">Actions</h3>
            <OrderStatusActions
              status={selectedOrder.status}
              busy={busy}
              onAdvance={(next) => advance(selectedOrder, next)}
              onCancel={() => cancel(selectedOrder)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

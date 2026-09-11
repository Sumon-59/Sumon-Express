"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTaka } from "@/types/product";
import { formatDate } from "@/lib/format";
import { AdminCustomer } from "@/types/customer";
import { OrderListResponse, STATUS_STYLES } from "@/types/order";

export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [customer, setCustomer] = React.useState<AdminCustomer | null>(null);
  const [orders, setOrders] = React.useState<OrderListResponse | null>(null);
  const [historyPage, setHistoryPage] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [roleSaving, setRoleSaving] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Identity + computed totals, and the order history via the
        // user-filtered orders listing — two calls, no bespoke endpoint.
        // The history is properly paginated: ALL orders reachable.
        const [c, o] = await Promise.all([
          api.get<AdminCustomer>(`/admin/customers/${id}`),
          api.get<OrderListResponse>(`/admin/orders?user=${id}&page=${historyPage}&limit=10`),
        ]);
        if (!alive) return;
        setCustomer(c.data);
        setOrders(o.data);
      } catch (err) {
        if (alive) setError(getApiErrorMessage(err, "Failed to load customer"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, historyPage]);

  return (
    <div>
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" /> Back to customers
      </Link>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-24 animate-pulse rounded-md bg-muted" />
          <div className="h-40 animate-pulse rounded-md bg-muted" />
        </div>
      ) : customer ? (
        <>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{customer.name}</h1>
              <p className="text-sm text-muted-foreground">{customer.email}</p>
              <p className="text-xs text-muted-foreground">
                Customer since {formatDate(customer.createdAt)}
              </p>
            </div>
            {/* Role (Slice 14): user ↔ staff only — the server refuses
                anything else, including your own row. */}
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Role</span>
              <select
                value={customer.role ?? "user"}
                disabled={roleSaving}
                onChange={async (e) => {
                  const role = e.target.value as "user" | "staff";
                  try {
                    setRoleSaving(true);
                    setError(null);
                    await api.put(`/admin/customers/${id}/role`, { role });
                    setCustomer((c) => (c ? { ...c, role } : c));
                  } catch (err) {
                    setError(getApiErrorMessage(err, "Could not change the role"));
                  } finally {
                    setRoleSaving(false);
                  }
                }}
                className="h-8 rounded-md border bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="user">Customer</option>
                <option value="staff">Staff (orders only)</option>
              </select>
            </label>
          </div>

          {/* The three computed totals, straight from the census. */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Orders</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{customer.orderCount}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Lifetime spend</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatTaka(customer.totalSpent)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Last order</p>
              <p className="mt-1 text-2xl font-semibold">{formatDate(customer.lastOrderAt)}</p>
            </div>
          </div>

          <h2 className="mt-6 text-sm font-semibold text-muted-foreground">Order history</h2>
          {!orders || orders.orders.length === 0 ? (
            <div className="mt-2 rounded-lg border bg-card p-8 text-center text-muted-foreground">
              No orders yet.
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-3 font-medium">Order</th>
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 font-medium">Items</th>
                    <th className="p-3 font-medium">Total</th>
                    <th className="p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.orders.map((o) => (
                    <tr key={o._id} className="border-b last:border-0">
                      <td className="p-3">
                        {/* Deep link: opens the Orders page filtered to
                            this customer with the drawer on this order. */}
                        <Link
                          href={`/admin/orders?user=${id}&open=${o._id}`}
                          className="font-mono text-xs text-muted-foreground hover:text-primary"
                        >
                          #{o._id.slice(-8)}
                        </Link>
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
          )}

          {orders && orders.pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((n) => n - 1)}
              >
                Prev
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                Page {historyPage} of {orders.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={historyPage >= orders.pages}
                onClick={() => setHistoryPage((n) => n + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

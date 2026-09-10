"use client";

import React from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import RevenueChart from "@/components/admin/RevenueChart";
import { formatTaka } from "@/types/product";
import { AnalyticsResponse } from "@/types/analytics";
import { ORDER_STATUS_ORDER, STATUS_STYLES } from "@/types/order";

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = React.useState<AnalyticsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    api
      .get<AnalyticsResponse>("/admin/analytics")
      .then((res) => alive && setData(res.data))
      .catch((err) => alive && setError(getApiErrorMessage(err, "Failed to load analytics")));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  const { totals, ordersByStatus, revenueByDay, topProducts } = data;

  return (
    <div>
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Realized revenue" value={formatTaka(totals.realizedRevenue)} hint="delivered orders" />
        <StatTile label="Pending value" value={formatTaka(totals.pendingValue)} hint="in pipeline — not yet realized" />
        <StatTile label="Orders" value={String(totals.orders)} hint="excluding cancelled" />
        <StatTile
          label="Customers"
          value={String(totals.customers)}
          hint={`+${totals.newCustomers30d} in 30 days`}
        />
        <StatTile label="Avg order value" value={formatTaka(totals.avgOrderValue)} />
      </div>

      <div className="mt-4 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">Revenue — last 30 days</h2>
        <div className="mt-3">
          <RevenueChart days={revenueByDay} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Orders by status</h2>
          <ul className="mt-3 space-y-2">
            {ORDER_STATUS_ORDER.map((s) => (
              <li key={s} className="flex items-center justify-between text-sm">
                <Badge variant="outline" className={`capitalize ${STATUS_STYLES[s]}`}>
                  {s}
                </Badge>
                <span className="tabular-nums">{ordersByStatus[s] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold">Top products by quantity</h2>
          {topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {topProducts.map((p, i) => (
                <li key={p.productId} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 tabular-nums text-muted-foreground">{i + 1}.</span>
                    {p.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">× {p.quantity}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

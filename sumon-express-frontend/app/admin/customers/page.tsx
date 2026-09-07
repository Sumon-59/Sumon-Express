"use client";

import React from "react";
import Link from "next/link";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { formatTaka } from "@/types/product";
import { formatDate } from "@/lib/format";
import { AdminCustomer, CustomerListResponse, CustomerSort } from "@/types/customer";

export default function AdminCustomersPage() {
  const [sort, setSort] = React.useState<CustomerSort>("spent");
  const [page, setPage] = React.useState(1);

  const [data, setData] = React.useState<CustomerListResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ page: String(page), limit: "10", sort });
        const res = await api.get<CustomerListResponse>(`/admin/customers?${params}`);
        if (alive) setData(res.data);
      } catch (err) {
        if (alive) setError(getApiErrorMessage(err, "Failed to load customers"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [page, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          {data && (
            <p className="text-sm text-muted-foreground">
              {data.total} customer{data.total === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <select
          value={sort}
          onChange={(e) => {
            setPage(1);
            setSort(e.target.value as CustomerSort);
          }}
          aria-label="Sort customers"
          className="h-9 rounded-md border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="spent">Biggest spenders</option>
          <option value="newest">Newest signups</option>
        </select>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : !data || data.customers.length === 0 ? (
        <div className="mt-8 rounded-lg border bg-card p-10 text-center text-muted-foreground">
          No customers yet.
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium">Customer</th>
                  <th className="p-3 font-medium">Joined</th>
                  <th className="p-3 font-medium">Orders</th>
                  <th className="p-3 font-medium">Lifetime spend</th>
                  <th className="p-3 font-medium">Last order</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((c: AdminCustomer) => (
                  <tr key={c._id} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="p-3">
                      <Link href={`/admin/customers/${c._id}`} className="group">
                        <span className="font-medium group-hover:text-primary">{c.name}</span>
                        <span className="block text-xs text-muted-foreground">{c.email}</span>
                      </Link>
                    </td>
                    <td className="p-3 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                    <td className="p-3 tabular-nums">{c.orderCount}</td>
                    <td className="p-3 tabular-nums">{formatTaka(c.totalSpent)}</td>
                    <td className="p-3 whitespace-nowrap">{formatDate(c.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
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
    </div>
  );
}

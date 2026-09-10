"use client";

import React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTaka } from "@/types/product";
import { formatDate } from "@/lib/format";
import { AdminDiscount, DiscountListResponse } from "@/types/discount";

const describeValue = (d: AdminDiscount) =>
  d.type === "percent" ? `${d.value}% off` : `${formatTaka(d.value)} off`;

export default function AdminDiscountsPage() {
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<DiscountListResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const fetchList = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<DiscountListResponse>(`/admin/discounts?page=${page}&limit=10`);
      setData(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load discounts"));
    } finally {
      setLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  const setActive = async (d: AdminDiscount, isActive: boolean) => {
    if (!isActive && !window.confirm(`Deactivate ${d.code}? Shoppers will be refused immediately.`))
      return;
    try {
      setBusyId(d._id);
      await api.put(`/admin/discounts/${d._id}`, { isActive });
      await fetchList();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update discount"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Discounts</h1>
          {data && (
            <p className="text-sm text-muted-foreground">
              {data.total} code{data.total === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/admin/discounts/new">
            <Plus className="mr-1 h-4 w-4" /> New Code
          </Link>
        </Button>
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
      ) : !data || data.discounts.length === 0 ? (
        <div className="mt-8 rounded-lg border bg-card p-10 text-center text-muted-foreground">
          No discount codes yet — create your first campaign.
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium">Code</th>
                  <th className="p-3 font-medium">Discount</th>
                  <th className="p-3 font-medium">Min order</th>
                  <th className="p-3 font-medium">Expires</th>
                  <th className="p-3 font-medium">Used</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.discounts.map((d) => (
                  <tr key={d._id} className="border-b last:border-0">
                    <td className="p-3 font-mono font-medium">{d.code}</td>
                    <td className="p-3">{describeValue(d)}</td>
                    <td className="p-3 tabular-nums">
                      {d.minOrder > 0 ? formatTaka(d.minOrder) : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">{formatDate(d.expiresAt)}</td>
                    <td className="p-3 tabular-nums">
                      {d.usedCount}
                      {d.usageLimit != null ? ` / ${d.usageLimit}` : ""}
                    </td>
                    <td className="p-3">
                      {d.isActive ? (
                        <Badge variant="outline" className="border-green-200 bg-green-100 text-green-800">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-neutral-300 bg-neutral-100 text-neutral-600">
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/discounts/${d._id}/edit`}>Edit</Link>
                        </Button>
                        {d.isActive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                            disabled={busyId === d._id}
                            onClick={() => setActive(d, false)}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === d._id}
                            onClick={() => setActive(d, true)}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </td>
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

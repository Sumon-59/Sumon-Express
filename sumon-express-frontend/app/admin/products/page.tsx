"use client";

import React from "react";
import Link from "next/link";
import { ImageIcon, Plus, Search } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Product, ProductListResponse, formatTaka } from "@/types/product";

type StatusFilter = "all" | "active" | "inactive";

export default function AdminProductsPage() {
  const [q, setQ] = React.useState("");
  const [search, setSearch] = React.useState(""); // submitted search
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [page, setPage] = React.useState(1);

  const [data, setData] = React.useState<ProductListResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const fetchList = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (search) params.set("q", search);
      if (status !== "all") params.set("status", status);

      const res = await api.get<ProductListResponse>(`/admin/products?${params}`);
      setData(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load products"));
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  const deactivate = async (p: Product) => {
    if (!window.confirm(`Deactivate “${p.name}”? Shoppers will no longer see it.`)) return;
    try {
      setBusyId(p._id);
      await api.delete(`/products/${p._id}`);
      await fetchList();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to deactivate"));
    } finally {
      setBusyId(null);
    }
  };

  const reactivate = async (p: Product) => {
    try {
      setBusyId(p._id);
      await api.put(`/products/${p._id}`, { isActive: true });
      await fetchList();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to reactivate"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Products</h1>
          {data && (
            <p className="text-sm text-muted-foreground">
              {data.total} product{data.total === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <Plus className="mr-1 h-4 w-4" /> New Product
          </Link>
        </Button>
      </div>

      {/* Search + status filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q.trim());
          }}
          className="flex"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="h-9 w-56 rounded-l-md border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex h-9 w-10 items-center justify-center rounded-r-md border border-l-0 bg-muted transition-colors hover:bg-accent"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>

        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as StatusFilter);
          }}
          aria-label="Filter by status"
          className="h-9 rounded-md border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
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
      ) : !data || data.products.length === 0 ? (
        <div className="mt-8 rounded-lg border bg-card p-10 text-center text-muted-foreground">
          No products match.
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium">Product</th>
                  <th className="p-3 font-medium">Price</th>
                  <th className="p-3 font-medium">Stock</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p._id} className="border-b last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                          {p.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.images[0]}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <span className="max-w-64 truncate font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="p-3 tabular-nums">
                      {p.discountPrice != null ? (
                        <>
                          <span className="text-primary">{formatTaka(p.discountPrice)}</span>{" "}
                          <span className="text-xs text-muted-foreground line-through">
                            {formatTaka(p.price)}
                          </span>
                        </>
                      ) : (
                        formatTaka(p.price)
                      )}
                    </td>
                    <td className="p-3 tabular-nums">
                      {p.stock}
                      {p.stock > 0 && p.stock <= 5 && (
                        <span className="ml-2 text-xs text-destructive">low</span>
                      )}
                      {p.stock === 0 && (
                        <span className="ml-2 text-xs text-destructive">out</span>
                      )}
                    </td>
                    <td className="p-3">
                      {p.isActive !== false ? (
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
                          <Link href={`/admin/products/${p._id}/edit`}>Edit</Link>
                        </Button>
                        {p.isActive !== false ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
                            disabled={busyId === p._id}
                            onClick={() => deactivate(p)}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === p._id}
                            onClick={() => reactivate(p)}
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
    </div>
  );
}

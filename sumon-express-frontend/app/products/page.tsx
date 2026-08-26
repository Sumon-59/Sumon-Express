"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { Product, Category, ProductListResponse } from "@/types/product";

function ProductsBrowser() {
  const router = useRouter();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const sort = params.get("sort") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [pages, setPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [categories, setCategories] = React.useState<Category[]>([]);

  React.useEffect(() => {
    api
      .get<Category[]>("/categories")
      .then((res) => Array.isArray(res.data) && setCategories(res.data))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const search = new URLSearchParams({ page: String(page), limit: "12" });
        if (q) search.set("q", q);
        if (category) search.set("category", category);
        if (sort) search.set("sort", sort);

        const res = await api.get<ProductListResponse>(`/products?${search.toString()}`);
        if (cancelled) return;
        setProducts(res.data.products ?? []);
        setPages(res.data.pages ?? 1);
        setTotal(res.data.total ?? 0);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.message || err?.message || "Failed to load products");
        setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, category, sort, page]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.push(`/products?${next.toString()}`);
  };

  const activeCategory = categories.find((c) => c._id === category);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {q ? `Results for “${q}”` : activeCategory ? activeCategory.name : "All Products"}
          </h1>
          {!loading && !error && (
            <p className="text-sm text-muted-foreground">
              {total} item{total === 1 ? "" : "s"} found
            </p>
          )}
        </div>

        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          aria-label="Sort products"
          className="h-9 rounded-md border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setParam("category", "")}
            className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
              !category ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary hover:text-primary"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c._id}
              onClick={() => setParam("category", c._id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                category === c._id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:border-primary hover:text-primary"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => router.refresh()}>Retry</Button>
        </div>
      ) : products.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <SearchX className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">No products found</p>
          <p className="text-sm text-muted-foreground">Try a different search or category.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>

          {pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setParam("page", String(page - 1))}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setParam("page", String(page + 1))}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground">Loading…</div>}>
      <ProductsBrowser />
    </Suspense>
  );
}

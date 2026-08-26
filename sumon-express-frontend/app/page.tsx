"use client";

import React from "react";
import Link from "next/link";
import { Truck, ShieldCheck, RotateCcw, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { Product, Category, ProductListResponse } from "@/types/product";

export default function HomePage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const [prodRes, catRes] = await Promise.allSettled([
          api.get<ProductListResponse>("/products?limit=8"),
          api.get<Category[]>("/categories"),
        ]);
        if (prodRes.status === "fulfilled") {
          setProducts(prodRes.value.data.products ?? []);
        }
        if (catRes.status === "fulfilled" && Array.isArray(catRes.value.data)) {
          setCategories(catRes.value.data);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main>
      {/* Hero */}
      <section className="bg-gradient-to-r from-primary to-orange-500">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-14 md:py-20">
          <h1 className="max-w-xl text-balance text-3xl font-bold text-white md:text-5xl">
            Everything you need, delivered express.
          </h1>
          <p className="max-w-lg text-white/85 md:text-lg">
            Shop electronics, accessories and more — with cash on delivery across Bangladesh.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-2 font-semibold">
            <Link href="/products">
              Shop Now <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <Truck className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Fast delivery</p>
              <p className="text-xs text-muted-foreground">Nationwide within days</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Cash on delivery</p>
              <p className="text-xs text-muted-foreground">Pay when it arrives</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RotateCcw className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">Easy cancellation</p>
              <p className="text-xs text-muted-foreground">Cancel before shipping</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-16">
        {/* Categories */}
        {categories.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Shop by category</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((c) => (
                <Link
                  key={c._id}
                  href={`/products?category=${c._id}`}
                  className="rounded-full border bg-card px-4 py-1.5 text-sm transition-colors hover:border-primary hover:text-primary"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Products */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Just for you</h2>
            <Link href="/products" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>

          {loading ? (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="mt-6 text-muted-foreground">No products available right now.</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, ImageIcon, Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Product, finalPrice, discountPercent, formatTaka } from "@/types/product";

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addItem } = useCart();
  const id = params?.id;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [product, setProduct] = React.useState<Product | null>(null);
  const [qty, setQty] = React.useState(1);
  const [added, setAdded] = React.useState(false);

  const fetchProduct = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/products/${id}`);
      setProduct(res.data?.product ?? res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to load product");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (id) fetchProduct();
  }, [id, fetchProduct]);

  const addToCart = () => {
    if (!product) return;
    addItem(
      {
        productId: product._id,
        name: product.name,
        price: finalPrice(product),
        image: product.images?.[0],
      },
      qty
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const buyNow = () => {
    if (!product) return;
    addItem(
      {
        productId: product._id,
        name: product.name,
        price: finalPrice(product),
        image: product.images?.[0],
      },
      qty
    );
    router.push("/checkout");
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-lg bg-muted" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-destructive">{error ?? "Product not found."}</p>
        <div className="mt-4 flex justify-center gap-3">
          <Button variant="outline" onClick={fetchProduct}>Retry</Button>
          <Button asChild>
            <Link href="/products">Back to Products</Link>
          </Button>
        </div>
      </main>
    );
  }

  const off = discountPercent(product);
  const image = product.images?.[0];
  const categoryName =
    product.category && typeof product.category === "object" ? product.category.name : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/products" className="hover:text-primary">Products</Link>
        {categoryName && (
          <>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>{categoryName}</span>
          </>
        )}
      </nav>

      <div className="mt-4 grid gap-8 rounded-lg border bg-card p-4 md:grid-cols-2 md:p-6">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-16 w-16" aria-hidden />
            </div>
          )}
          {off > 0 && (
            <span className="absolute left-3 top-3 rounded bg-primary px-2 py-1 text-sm font-semibold text-primary-foreground">
              -{off}%
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="text-balance text-2xl font-semibold">{product.name}</h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">
              {formatTaka(finalPrice(product))}
            </span>
            {off > 0 && (
              <span className="text-lg text-muted-foreground line-through">
                {formatTaka(product.price)}
              </span>
            )}
          </div>

          <p className={`mt-2 text-sm ${product.stock > 0 ? "text-green-600" : "text-destructive"}`}>
            {product.stock > 0 ? `In stock — ${product.stock} available` : "Out of stock"}
          </p>

          <Separator className="my-4" />

          <p className="text-sm leading-6 text-muted-foreground">{product.description}</p>

          <div className="mt-auto pt-6">
            {/* Quantity */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Quantity</span>
              <div className="flex items-center rounded-md border">
                <button
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-medium tabular-nums">{qty}</span>
                <button
                  onClick={() => setQty((n) => Math.min(product.stock, n + 1))}
                  disabled={qty >= product.stock}
                  aria-label="Increase quantity"
                  className="flex h-9 w-9 items-center justify-center transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                variant="outline"
                className="flex-1 border-primary text-primary hover:bg-primary/5 hover:text-primary"
                onClick={addToCart}
                disabled={product.stock <= 0}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {added ? "Added ✓" : "Add to Cart"}
              </Button>
              <Button size="lg" className="flex-1" onClick={buyNow} disabled={product.stock <= 0}>
                <Zap className="mr-2 h-4 w-4" /> Buy Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

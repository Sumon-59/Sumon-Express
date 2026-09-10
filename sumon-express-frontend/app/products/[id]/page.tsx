"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight, ImageIcon, Minus, Plus, ShoppingCart, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Product,
  ProductVariant,
  finalPrice,
  variantPrice,
  discountPercent,
  formatTaka,
} from "@/types/product";

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
  const [imageIndex, setImageIndex] = React.useState(0);
  const [variantName, setVariantName] = React.useState<string | null>(null);

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

  const hasAxis = Boolean(product?.optionName && product?.variants?.length);
  const selected: ProductVariant | null =
    (hasAxis && product?.variants?.find((v) => v.name === variantName)) || null;
  // Plain products buy against top-level stock; variant products
  // against the CHOSEN value's stock (none chosen = can't buy yet).
  const buyableStock = hasAxis ? selected?.stock ?? 0 : product?.stock ?? 0;
  const unitPrice = product
    ? selected
      ? variantPrice(product, selected)
      : finalPrice(product)
    : 0;

  const cartLine = () =>
    product && {
      productId: product._id,
      name: product.name,
      price: unitPrice,
      image: product.images?.[0],
      ...(selected ? { variant: selected.name } : {}),
    };

  const addToCart = () => {
    const line = cartLine();
    if (!line) return;
    addItem(line, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const buyNow = () => {
    const line = cartLine();
    if (!line) return;
    addItem(line, qty);
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
  const images = product.images ?? [];
  const image = images[Math.min(imageIndex, Math.max(0, images.length - 1))];
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
        {/* Gallery: main image + clickable thumbnails (Slice 7) */}
        <div>
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
          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImageIndex(i)}
                  aria-label={`Show image ${i + 1}`}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                    i === imageIndex ? "border-primary" : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <h1 className="text-balance text-2xl font-semibold">{product.name}</h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">{formatTaka(unitPrice)}</span>
            {off > 0 && !selected?.price && (
              <span className="text-lg text-muted-foreground line-through">
                {formatTaka(product.price)}
              </span>
            )}
          </div>

          {/* Variant picker: sold-out values visible but disabled */}
          {hasAxis && (
            <div className="mt-4">
              <p className="text-sm font-medium">{product.optionName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {product.variants!.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    disabled={v.stock <= 0}
                    onClick={() => {
                      setVariantName(v.name);
                      setQty(1);
                    }}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      variantName === v.name
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "hover:border-muted-foreground/40"
                    } disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p
            className={`mt-2 text-sm ${
              buyableStock > 0
                ? "text-green-600"
                : hasAxis && !selected
                  ? "text-muted-foreground"
                  : "text-destructive"
            }`}
          >
            {hasAxis && !selected
              ? `Choose a ${product.optionName}`
              : buyableStock > 0
                ? `In stock — ${buyableStock} available`
                : "Out of stock"}
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
                  onClick={() => setQty((n) => Math.min(Math.max(1, buyableStock), n + 1))}
                  disabled={qty >= buyableStock}
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
                disabled={buyableStock <= 0}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {added ? "Added ✓" : "Add to Cart"}
              </Button>
              <Button size="lg" className="flex-1" onClick={buyNow} disabled={buyableStock <= 0}>
                <Zap className="mr-2 h-4 w-4" /> Buy Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

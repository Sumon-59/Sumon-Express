"use client";

import React from "react";
import Link from "next/link";
import { ImageIcon, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatTaka } from "@/types/product";

export default function CartPage() {
  const { items, total, removeItem, updateQty, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-20 text-center">
        <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Your cart is empty</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse products and add something you like.
        </p>
        <Button asChild className="mt-6">
          <Link href="/products">Continue Shopping</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl font-semibold">
        Shopping Cart <span className="text-muted-foreground">({items.length})</span>
      </h1>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Items */}
        <div className="space-y-3">
          {items.map((x) => (
            <div key={x.productId} className="flex gap-4 rounded-lg border bg-card p-4">
              <Link
                href={`/products/${x.productId}`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted"
              >
                {x.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={x.image} alt={x.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-6 w-6" aria-hidden />
                  </div>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/products/${x.productId}`}
                  className="line-clamp-2 text-sm font-medium hover:text-primary"
                >
                  {x.name}
                </Link>
                <span className="mt-1 text-sm font-semibold text-primary">
                  {formatTaka(x.price)}
                </span>

                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-md border">
                    <button
                      onClick={() => updateQty(x.productId, x.quantity - 1)}
                      disabled={x.quantity <= 1}
                      aria-label="Decrease quantity"
                      className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-9 text-center text-sm tabular-nums">{x.quantity}</span>
                    <button
                      onClick={() => updateQty(x.productId, x.quantity + 1)}
                      aria-label="Increase quantity"
                      className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-muted"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(x.productId)}
                    aria-label={`Remove ${x.name}`}
                    className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                </div>
              </div>

              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-sm text-muted-foreground">Subtotal</p>
                <p className="font-semibold tabular-nums">{formatTaka(x.price * x.quantity)}</p>
              </div>
            </div>
          ))}

          <button
            onClick={clearCart}
            className="text-sm text-muted-foreground transition-colors hover:text-destructive"
          >
            Clear cart
          </button>
        </div>

        {/* Summary */}
        <aside className="h-fit rounded-lg border bg-card p-5 lg:sticky lg:top-20">
          <h2 className="font-semibold">Order Summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatTaka(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery</span>
              <span className="text-green-600">Free</span>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="tabular-nums text-primary">{formatTaka(total)}</span>
          </div>
          <Button asChild size="lg" className="mt-5 w-full">
            <Link href="/checkout">Proceed to Checkout</Link>
          </Button>
          <Button asChild variant="ghost" className="mt-2 w-full">
            <Link href="/products">Continue shopping</Link>
          </Button>
        </aside>
      </div>
    </main>
  );
}

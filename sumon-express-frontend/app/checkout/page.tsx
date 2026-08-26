"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, ImageIcon } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatTaka } from "@/types/product";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const { user, loading } = useAuth();

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [phone, setPhone] = React.useState("");

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    if (!address.trim() || !city.trim() || !phone.trim()) {
      setError("Please fill in your delivery address, city and phone number.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        items: items.map((x) => ({
          product: x.productId,
          quantity: x.quantity,
        })),
        shippingAddress: { address: address.trim(), city: city.trim(), phone: phone.trim() },
        paymentMethod: "cod",
      };

      await api.post("/orders", payload);

      clearCart();
      router.push("/orders");
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground">Loading…</main>;
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Nothing to check out</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your cart is empty.</p>
        <Button asChild className="mt-6">
          <Link href="/products">Browse Products</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl font-semibold">Checkout</h1>

      <form onSubmit={placeOrder} className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Delivery details */}
        <div className="space-y-6">
          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold">Delivery Information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House, road, area"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Dhaka"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  required
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold">Payment Method</h2>
            <div className="mt-4 flex items-center gap-3 rounded-md border border-primary bg-primary/5 p-3">
              <Banknote className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Cash on Delivery</p>
                <p className="text-xs text-muted-foreground">Pay when your order arrives</p>
              </div>
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="h-fit rounded-lg border bg-card p-5 lg:sticky lg:top-20">
          <h2 className="font-semibold">Your Order</h2>
          <div className="mt-4 space-y-3">
            {items.map((x) => (
              <div key={x.productId} className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                  {x.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.image} alt={x.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-4 w-4" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{x.name}</p>
                  <p className="text-xs text-muted-foreground">× {x.quantity}</p>
                </div>
                <span className="text-sm tabular-nums">{formatTaka(x.price * x.quantity)}</span>
              </div>
            ))}
          </div>

          <Separator className="my-4" />
          <div className="space-y-2 text-sm">
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

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={submitting}>
            {submitting ? "Placing order…" : "Place Order"}
          </Button>
          <Button asChild variant="ghost" className="mt-2 w-full">
            <Link href="/cart">Back to cart</Link>
          </Button>
        </aside>
      </form>
    </main>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, User, Package, LogOut, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { items } = useCart();
  const [q, setQ] = React.useState("");

  const cartCount = items.reduce((sum, x) => sum + x.quantity, 0);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/products?q=${encodeURIComponent(q.trim())}` : "/products");
  };

  const onLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 bg-primary shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="shrink-0 text-xl font-bold tracking-tight text-primary-foreground">
          Sumon<span className="font-light">Express</span>
        </Link>

        <form onSubmit={onSearch} className="order-last flex w-full min-w-0 md:order-none md:flex-1 md:basis-0">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="h-10 w-full min-w-0 rounded-l-md border-0 bg-white px-4 text-sm text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/60"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex h-10 w-12 items-center justify-center rounded-r-md bg-orange-200 text-orange-900 transition-colors hover:bg-orange-300"
          >
            <Search className="h-5 w-5" />
          </button>
        </form>

        <nav className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          <Link
            href="/cart"
            className="relative flex h-10 items-center gap-2 rounded-md px-3 text-primary-foreground transition-colors hover:bg-white/15"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden text-sm sm:inline">Cart</span>
            {cartCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-primary">
                {cartCount}
              </span>
            )}
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-10 items-center gap-2 rounded-md px-3 text-primary-foreground transition-colors hover:bg-white/15">
                  <User className="h-5 w-5" />
                  <span className="hidden max-w-32 truncate text-sm sm:inline">
                    {user.name ?? user.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/orders")}>
                  <Package className="mr-2 h-4 w-4" /> My Orders
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => router.push("/admin")}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" className="text-primary-foreground hover:bg-white/15 hover:text-primary-foreground">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/register">Sign Up</Link>
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

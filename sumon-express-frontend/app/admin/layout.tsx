"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  TicketPercent,
  Settings,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/discounts", label: "Discounts", icon: TicketPercent },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    // Guard is UX only — the server answers 403 regardless.
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/");
    }
  }, [loading, user, router]);

  // Render NOTHING until the session is known: no admin content may
  // flash for non-admins while the check is in flight.
  if (loading || !user || user.role !== "admin") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Checking access…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
      <aside className="w-52 shrink-0">
        <nav className="sticky top-20 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { items } = useCart();

  const cartCount = items.reduce((sum, x) => sum + x.quantity, 0);

  const onLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div style={{ borderBottom: "1px solid #ddd", padding: "10px 16px", display: "flex", gap: 12 }}>
      <Link href="/products"><b>Sumon Express</b></Link>
      <Link href="/products">Products</Link>
      <Link href="/cart">Cart ({cartCount})</Link>
      <Link href="/orders">Orders</Link>

      <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
        {user ? (
          <>
            <span style={{ opacity: 0.8 }}>{user.email}</span>
            <button onClick={onLogout}>Logout</button>
          </>
        ) : (
          <>
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
          </>
        )}
      </div>
    </div>
  );
}

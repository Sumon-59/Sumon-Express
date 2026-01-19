"use client";

import React from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Product = {
  _id: string;
  name: string;
  price: number;
  stock?: number;
  isActive?: boolean;
  images?: string[];
};

export default function ProductsPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get("/products");
      const list: Product[] = res.data?.products ?? res.data ?? [];

      // Optional: only show active products if isActive exists
      const visible = Array.isArray(list)
        ? list.filter((p) => (typeof p.isActive === "boolean" ? p.isActive : true))
        : [];

      setProducts(visible);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to load products";
      setError(msg);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchProducts();
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading products...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Products</h2>
        <p style={{ color: "red" }}>{error}</p>
        <button onClick={fetchProducts}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Products</h2>
        <Link href="/cart">Go to Cart</Link>
      </div>

      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          {products.map((p) => (
            <Link
              key={p._id}
              href={`/products/${p._id}`}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 12,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontWeight: 700 }}>{p.name}</div>

              <div style={{ marginTop: 6 }}>
                <span style={{ fontWeight: 600 }}>Price:</span> ৳{p.price}
              </div>

              <div style={{ marginTop: 6, opacity: 0.8 }}>
                <span style={{ fontWeight: 600 }}>Stock:</span>{" "}
                {typeof p.stock === "number" ? p.stock : "N/A"}
              </div>

              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7 }}>
                Click to view details →
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

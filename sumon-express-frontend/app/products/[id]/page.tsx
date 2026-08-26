"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useCart } from "@/context/CartContext";

type Product = {
  _id: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  stock: number;
  images?: string[];
};

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { addItem } = useCart();
  const id = params?.id;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [product, setProduct] = React.useState<Product | null>(null);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get(`/products/${id}`);
      const p: Product = res.data?.product ?? res.data;

      setProduct(p);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to load product";
      setError(msg);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!id) return;
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addToCart = () => {
  if (!product) return;
  addItem(
    {
      productId: product._id,
      name: product.name,
      price: product.discountPrice ?? product.price,
    },
    1
  );
  router.push("/cart");
};


  if (loading) return <div style={{ padding: 20 }}>Loading product...</div>;

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Product Details</h2>
        <p style={{ color: "red" }}>{error}</p>
        <button onClick={fetchProduct}>Retry</button>
        <div style={{ marginTop: 12 }}>
          <Link href="/products">← Back to Products</Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ padding: 20 }}>
        <p>Product not found.</p>
        <Link href="/products">← Back to Products</Link>
      </div>
    );
  }

  const finalPrice = product.discountPrice ?? product.price;

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <Link href="/products">← Back to Products</Link>

      <h2 style={{ marginTop: 12 }}>{product.name}</h2>

      <p style={{ opacity: 0.85 }}>{product.description}</p>

      <div style={{ marginTop: 10 }}>
        <div>
          <strong>Price:</strong> ৳{finalPrice}{" "}
          {product.discountPrice ? (
            <span style={{ textDecoration: "line-through", opacity: 0.6, marginLeft: 8 }}>
              ৳{product.price}
            </span>
          ) : null}
        </div>

        <div style={{ marginTop: 6 }}>
          <strong>Stock:</strong> {product.stock}
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <button
          onClick={addToCart}
          disabled={product.stock <= 0}
          style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #111" }}
        >
          {product.stock <= 0 ? "Out of stock" : "Add to Cart"}
        </button>

        <Link href="/cart" style={{ alignSelf: "center" }}>
          Go to Cart →
        </Link>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { api } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/types/product";

// A strip of same-category siblings for one product (Slice 8). Renders
// NOTHING when there are none — an empty recommendation is noise.
export default function RelatedProducts({
  productId,
  title = "Related products",
}: {
  productId: string;
  title?: string;
}) {
  const [products, setProducts] = React.useState<Product[]>([]);

  React.useEffect(() => {
    let alive = true;
    api
      .get<Product[]>(`/products/${productId}/related`)
      .then((res) => alive && Array.isArray(res.data) && setProducts(res.data))
      .catch(() => {}); // a missing strip is fine; never an error state
    return () => {
      alive = false;
    };
  }, [productId]);

  if (products.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </section>
  );
}

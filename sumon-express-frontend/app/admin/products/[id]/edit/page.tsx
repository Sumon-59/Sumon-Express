"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import ProductForm, { ProductPayload } from "@/components/admin/ProductForm";
import { Product } from "@/types/product";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [product, setProduct] = React.useState<Product | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!id) return;
    // Admin detail endpoint: inactive products load too (the public
    // detail would answer 404 for them by design).
    api
      .get<Product>(`/admin/products/${id}`)
      .then((res) => setProduct(res.data))
      .catch((err) => setError(getApiErrorMessage(err, "Failed to load product")))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async (payload: ProductPayload) => {
    await api.put(`/products/${id}`, payload);
    router.push("/admin/products");
  };

  return (
    <div>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" /> Back to products
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Edit Product</h1>

      {loading ? (
        <div className="mt-4 h-64 animate-pulse rounded-lg bg-muted" />
      ) : error || !product ? (
        <p className="mt-4 text-sm text-destructive">{error ?? "Product not found."}</p>
      ) : (
        <div className="mt-4 rounded-lg border bg-card p-5">
          <ProductForm initial={product} submitLabel="Save Changes" onSubmit={save} />
        </div>
      )}
    </div>
  );
}

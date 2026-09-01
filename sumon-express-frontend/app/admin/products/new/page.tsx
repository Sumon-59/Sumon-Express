"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import ProductForm, { ProductPayload } from "@/components/admin/ProductForm";

export default function NewProductPage() {
  const router = useRouter();

  const create = async (payload: ProductPayload) => {
    await api.post("/products", payload);
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
      <h1 className="mt-2 text-xl font-semibold">New Product</h1>
      <div className="mt-4 rounded-lg border bg-card p-5">
        <ProductForm submitLabel="Create Product" onSubmit={create} />
      </div>
    </div>
  );
}

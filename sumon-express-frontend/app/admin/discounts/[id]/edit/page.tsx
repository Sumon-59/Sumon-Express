"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import DiscountForm, { DiscountPayload } from "@/components/admin/DiscountForm";
import { AdminDiscount } from "@/types/discount";

export default function EditDiscountPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [discount, setDiscount] = React.useState<AdminDiscount | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    api
      .get<AdminDiscount>(`/admin/discounts/${id}`)
      .then((res) => setDiscount(res.data))
      .catch((err) => setError(getApiErrorMessage(err, "Failed to load discount")));
  }, [id]);

  const update = async (payload: DiscountPayload) => {
    await api.put(`/admin/discounts/${id}`, payload);
    router.push("/admin/discounts");
  };

  return (
    <div>
      <Link
        href="/admin/discounts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" /> Back to discounts
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Edit Discount Code</h1>
      {error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {discount ? (
        <div className="mt-4 rounded-lg border bg-card p-5">
          <DiscountForm initial={discount} submitLabel="Save Changes" onSubmit={update} />
        </div>
      ) : (
        !error && <div className="mt-4 h-64 animate-pulse rounded-lg bg-muted" />
      )}
    </div>
  );
}

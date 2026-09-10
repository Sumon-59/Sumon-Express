"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import DiscountForm, { DiscountPayload } from "@/components/admin/DiscountForm";

export default function NewDiscountPage() {
  const router = useRouter();

  const create = async (payload: DiscountPayload) => {
    await api.post("/admin/discounts", payload);
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
      <h1 className="mt-2 text-xl font-semibold">New Discount Code</h1>
      <div className="mt-4 rounded-lg border bg-card p-5">
        <DiscountForm submitLabel="Create Code" onSubmit={create} />
      </div>
    </div>
  );
}

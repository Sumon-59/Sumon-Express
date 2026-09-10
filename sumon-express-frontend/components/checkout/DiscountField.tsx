"use client";

import React from "react";
import { X } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatTaka } from "@/types/product";
import { CartLine, DiscountPreview } from "@/types/discount";

type Props = {
  items: CartLine[];
  // null = no code applied (initial state, or removed)
  onApplied: (preview: DiscountPreview | null) => void;
};

// The checkout's discount-code field. All math is the SERVER's: Apply
// sends the code + cart lines to the preview endpoint and displays
// whatever it answers; nothing is computed here.
export default function DiscountField({ items, onApplied }: Props) {
  const [code, setCode] = React.useState("");
  const [applied, setApplied] = React.useState<DiscountPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const apply = async () => {
    if (!code.trim()) return;
    try {
      setBusy(true);
      setError(null);
      const res = await api.post<DiscountPreview>("/discounts/preview", {
        code: code.trim(),
        items,
      });
      setApplied(res.data);
      onApplied(res.data);
    } catch (err) {
      setApplied(null);
      onApplied(null);
      setError(getApiErrorMessage(err, "Could not apply this code"));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    setApplied(null);
    setCode("");
    setError(null);
    onApplied(null);
  };

  if (applied) {
    return (
      <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm">
        <span className="text-green-800">
          <span className="font-medium">{applied.code}</span> applied — you save{" "}
          {formatTaka(applied.discountAmount)}
        </span>
        <button
          type="button"
          aria-label="Remove discount code"
          onClick={remove}
          className="text-green-800/60 transition-colors hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Discount code"
          aria-label="Discount code"
        />
        <Button type="button" variant="outline" disabled={busy || !code.trim()} onClick={apply}>
          {busy ? "Checking…" : "Apply"}
        </Button>
      </div>
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

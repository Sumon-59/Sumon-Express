"use client";

import React from "react";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminDiscount, DiscountType } from "@/types/discount";

// What the form submits — mirrors the backend's DiscountBody contract.
export type DiscountPayload = {
  code: string;
  type: DiscountType;
  value: number;
  minOrder: number;
  expiresAt: string | null; // ISO date or null = never expires
  usageLimit: number | null; // null = unlimited
};

type Props = {
  initial?: AdminDiscount;
  submitLabel: string;
  onSubmit: (payload: DiscountPayload) => Promise<void>;
};

export default function DiscountForm({ initial, submitLabel, onSubmit }: Props) {
  const [code, setCode] = React.useState(initial?.code ?? "");
  const [type, setType] = React.useState<DiscountType>(initial?.type ?? "percent");
  const [value, setValue] = React.useState(initial ? String(initial.value) : "");
  const [minOrder, setMinOrder] = React.useState(
    initial && initial.minOrder > 0 ? String(initial.minOrder) : ""
  );
  const [expiresAt, setExpiresAt] = React.useState(
    initial?.expiresAt ? initial.expiresAt.slice(0, 10) : ""
  );
  const [usageLimit, setUsageLimit] = React.useState(
    initial?.usageLimit != null ? String(initial.usageLimit) : ""
  );

  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Client mirror of the server's rules — immediate feedback only; the
  // server's validateDiscountData stays the authority.
  const validate = (): string | null => {
    if (!code.trim()) return "Code is required";
    const valueNum = Number(value);
    if (value === "" || Number.isNaN(valueNum)) return "Value must be a number";
    if (type === "percent" && (valueNum < 1 || valueNum > 100))
      return "Percent value must be between 1 and 100";
    if (type === "fixed" && valueNum <= 0) return "Fixed value must be positive";
    if (minOrder !== "" && Number(minOrder) < 0) return "Minimum order cannot be negative";
    if (usageLimit !== "" && (!Number.isInteger(Number(usageLimit)) || Number(usageLimit) < 1))
      return "Usage limit must be a positive whole number";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({
        code: code.trim().toUpperCase(),
        type,
        value: Number(value),
        minOrder: minOrder === "" ? 0 : Number(minOrder),
        // End of the chosen day, so "expires 2026-10-01" includes Oct 1.
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
        usageLimit: usageLimit === "" ? null : Number(usageLimit),
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save discount"));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      <div className="space-y-2">
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="EID10"
          className="font-mono uppercase"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as DiscountType)}
            className="h-9 w-full rounded-md border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed amount off (৳)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="value">{type === "percent" ? "Percent (1–100)" : "Amount (৳)"}</Label>
          <Input
            id="value"
            type="number"
            min={type === "percent" ? "1" : "1"}
            max={type === "percent" ? "100" : undefined}
            step="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="minOrder">Min order (৳, optional)</Label>
          <Input
            id="minOrder"
            type="number"
            min="0"
            step="1"
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
            placeholder="none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiresAt">Expires (optional)</Label>
          <Input
            id="expiresAt"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="usageLimit">Usage limit (optional)</Label>
          <Input
            id="usageLimit"
            type="number"
            min="1"
            step="1"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="unlimited"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

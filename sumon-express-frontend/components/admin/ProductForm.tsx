"use client";

import React from "react";
import { ImageIcon, Plus, Trash2 } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Category, Product } from "@/types/product";

// What the form submits — mirrors the backend's ProductBody contract.
export type ProductPayload = {
  name: string;
  description: string;
  price: number;
  discountPrice: number | null; // null = no discount / clear it
  stock: number;
  category?: string;
  images: string[];
};

type Props = {
  initial?: Product;
  submitLabel: string;
  onSubmit: (payload: ProductPayload) => Promise<void>;
};

export default function ProductForm({ initial, submitLabel, onSubmit }: Props) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [price, setPrice] = React.useState(initial ? String(initial.price) : "");
  const [discountPrice, setDiscountPrice] = React.useState(
    initial?.discountPrice != null ? String(initial.discountPrice) : ""
  );
  const [stock, setStock] = React.useState(initial ? String(initial.stock) : "");
  const [category, setCategory] = React.useState(
    initial?.category && typeof initial.category === "object" ? initial.category._id : ""
  );
  // Each row gets a stable id so removing one never confuses React's
  // reconciliation (index keys shift when a middle row is deleted).
  const nextImageId = React.useRef(0);
  const newImageRow = (url = "") => ({ id: nextImageId.current++, url });
  const [images, setImages] = React.useState(() =>
    initial?.images?.length ? initial.images.map((u) => newImageRow(u)) : [newImageRow()]
  );

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    api
      .get<Category[]>("/categories")
      .then((res) => Array.isArray(res.data) && setCategories(res.data))
      .catch(() => {});
  }, []);

  // Client-side mirror of the SERVER's rules (the server stays the
  // authority — this is only immediate feedback).
  const validate = (): string | null => {
    if (!name.trim()) return "Name is required";
    if (!description.trim()) return "Description is required";
    const priceNum = Number(price);
    if (price === "" || Number.isNaN(priceNum) || priceNum < 0)
      return "Price must be a non-negative number";
    const stockNum = Number(stock);
    if (stock === "" || !Number.isInteger(stockNum) || stockNum < 0)
      return "Stock must be a non-negative whole number";
    if (discountPrice !== "") {
      const discountNum = Number(discountPrice);
      if (Number.isNaN(discountNum) || discountNum < 0)
        return "Discount price must be a non-negative number";
      if (discountNum >= priceNum) return "Discount price must be less than price";
    }
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
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        discountPrice: discountPrice === "" ? null : Number(discountPrice),
        stock: Number(stock),
        category: category || undefined,
        images: images.map((row) => row.url.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to save product"));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full rounded-md border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="price">Price (৳)</Label>
          <Input
            id="price"
            type="number"
            min="0"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discountPrice">Discount price (optional)</Label>
          <Input
            id="discountPrice"
            type="number"
            min="0"
            step="any"
            value={discountPrice}
            onChange={(e) => setDiscountPrice(e.target.value)}
            placeholder="none"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock">Stock</Label>
          <Input
            id="stock"
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 w-full rounded-md border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label>Images (URLs)</Label>
        <div className="space-y-2">
          {images.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                {row.url.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                )}
              </div>
              <Input
                value={row.url}
                onChange={(e) =>
                  setImages((prev) =>
                    prev.map((r) => (r.id === row.id ? { ...r, url: e.target.value } : r))
                  )
                }
                placeholder="https://…"
              />
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => setImages((prev) => prev.filter((r) => r.id !== row.id))}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setImages((prev) => [...prev, newImageRow()])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add image URL
        </Button>
        <p className="text-xs text-muted-foreground">
          Broken links show as broken previews above — fix them before saving.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

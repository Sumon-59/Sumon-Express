"use client";

import React from "react";
import { ImageIcon, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { uploadProductImage, validateImageFile } from "@/lib/uploads";
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
  // A row is either a plain URL (pasted or finished upload), an upload
  // in flight (progress %), or a failed/rejected file (error message).
  type ImageRow = {
    id: number;
    url: string;
    fileName?: string;
    uploading?: boolean;
    progress?: number;
    error?: string;
  };
  const nextImageId = React.useRef(0);
  const newImageRow = (url = ""): ImageRow => ({ id: nextImageId.current++, url });
  const [images, setImages] = React.useState<ImageRow[]>(() =>
    initial?.images?.length ? initial.images.map((u) => newImageRow(u)) : [newImageRow()]
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const uploadsInFlight = images.some((r) => r.uploading);

  const patchRow = (id: number, patch: Partial<ImageRow>) =>
    setImages((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const handleFiles = (files: File[]) => {
    for (const file of files) {
      const row: ImageRow = { ...newImageRow(), fileName: file.name };
      const problem = validateImageFile(file);
      if (problem) {
        // Rejected before any bytes move — an error row, no request.
        setImages((prev) => [...prev, { ...row, error: problem }]);
        continue;
      }
      setImages((prev) => [...prev, { ...row, uploading: true, progress: 0 }]);
      uploadProductImage(file, (percent) => patchRow(row.id, { progress: percent }))
        .then((url) =>
          patchRow(row.id, { url, uploading: false, progress: undefined, fileName: undefined })
        )
        .catch((err) =>
          patchRow(row.id, {
            uploading: false,
            error: getApiErrorMessage(err, "Upload failed"),
          })
        );
    }
  };

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
        <Label>Images</Label>

        {/* Drop zone: drag files in, or click to browse. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(Array.from(e.dataTransfer.files));
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <UploadCloud className="h-6 w-6" />
          <span>
            Drag &amp; drop images here, or <span className="text-primary">browse</span>
          </span>
          <span className="text-xs">Image files up to 5 MB each</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            aria-label="Upload images"
            className="sr-only"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              handleFiles(Array.from(e.target.files ?? []));
              e.target.value = ""; // allow re-selecting the same file
            }}
          />
        </div>

        <div className="space-y-2">
          {images.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                {row.url.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    {row.uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                  </div>
                )}
              </div>

              {row.uploading ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{row.fileName}</p>
                  <div
                    role="progressbar"
                    aria-valuenow={row.progress ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${row.progress ?? 0}%` }}
                    />
                  </div>
                </div>
              ) : row.error ? (
                <p className="min-w-0 flex-1 truncate text-sm text-destructive">
                  {row.fileName ? `${row.fileName}: ` : ""}
                  {row.error}
                </p>
              ) : (
                <Input
                  value={row.url}
                  onChange={(e) =>
                    setImages((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, url: e.target.value } : r))
                    )
                  }
                  placeholder="https://…"
                />
              )}

              {/* Removing a row mid-upload is safe: the finished upload's
                  patch maps over rows and finds nothing — a no-op. */}
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

      <Button type="submit" disabled={submitting || uploadsInFlight}>
        {submitting ? "Saving…" : uploadsInFlight ? "Uploading…" : submitLabel}
      </Button>
    </form>
  );
}

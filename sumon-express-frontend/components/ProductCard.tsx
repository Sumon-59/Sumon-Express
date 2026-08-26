"use client";

import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { Product, finalPrice, discountPercent, formatTaka } from "@/types/product";

export default function ProductCard({ product }: { product: Product }) {
  const off = discountPercent(product);
  const image = product.images?.[0];

  return (
    <Link
      href={`/products/${product._id}`}
      className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-10 w-10" aria-hidden />
          </div>
        )}
        {off > 0 && (
          <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
            -{off}%
          </span>
        )}
        {product.stock <= 0 && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-1 text-center text-xs font-medium text-background">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm leading-5">{product.name}</h3>
        <div className="mt-auto flex items-baseline gap-2">
          <span className="text-base font-semibold text-primary">
            {formatTaka(finalPrice(product))}
          </span>
          {off > 0 && (
            <span className="text-xs text-muted-foreground line-through">
              {formatTaka(product.price)}
            </span>
          )}
        </div>
        {product.stock > 0 && product.stock <= 5 && (
          <span className="text-xs text-destructive">Only {product.stock} left</span>
        )}
      </div>
    </Link>
  );
}

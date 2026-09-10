import { PageMeta } from "./api";

export type Category = {
  _id: string;
  name: string;
};

// One value of a product's single option axis (Slice 7).
export type ProductVariant = {
  name: string;
  stock: number;
  price?: number | null;
};

export type Product = {
  _id: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  stock: number; // on a variant product: the sum of value stocks
  optionName?: string;
  variants?: ProductVariant[];
  images?: string[];
  isActive?: boolean;
  category?: Category | string | null;
  // Denormalized review numbers (Slice 9); absent on old payloads.
  ratingAvg?: number;
  ratingCount?: number;
};

export type ProductListResponse = PageMeta & {
  products: Product[];
};

export const finalPrice = (p: Product) => p.discountPrice ?? p.price;

// Unit price for one option value — the backend's pinned resolution
// order: override beats the sale price beats the base price.
export const variantPrice = (p: Product, v: ProductVariant) =>
  v.price ?? p.discountPrice ?? p.price;

export const discountPercent = (p: Product) =>
  p.discountPrice && p.discountPrice < p.price
    ? Math.round(((p.price - p.discountPrice) / p.price) * 100)
    : 0;

export const formatTaka = (n: number) => `৳${n.toLocaleString("en-IN")}`;

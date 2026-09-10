// Shared discount shapes (Slice 5).

import { PageMeta } from "./api";

export type DiscountType = "percent" | "fixed";

// A cart line as the API expects it — shared by the checkout payload
// and the preview request. `variant` rides along on variant products.
export type CartLine = { product: string; quantity: number; variant?: string };

export type AdminDiscount = {
  _id: string;
  code: string;
  type: DiscountType;
  value: number;
  minOrder: number;
  expiresAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt?: string;
};

export type DiscountListResponse = PageMeta & {
  discounts: AdminDiscount[];
};

// What the preview endpoint answers — all server-computed.
export type DiscountPreview = {
  code: string;
  subtotal: number;
  discountAmount: number;
  total: number;
};

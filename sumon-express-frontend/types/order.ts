// Shared order shapes for the admin Orders section (Slice 3).

import { PageMeta } from "./api";
import { DiscountType } from "./discount";

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

// The canonical display order — pipeline first, terminal last. Every
// surface that lists statuses derives from this (never hand-list).
export const ORDER_STATUS_ORDER: readonly OrderStatus[] = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

export type OrderItem = {
  product: string;
  name: string;
  price: number;
  quantity: number;
  variantName?: string; // the chosen option value (Slice 7)
};

// A row from the admin listing: customer populated, items embedded.
// Discount snapshot stored on the order at creation (Slice 5).
export type OrderDiscount = {
  code: string;
  type: DiscountType;
  value: number;
  amount: number;
};

// Shipping snapshot at order time (Slice 12) — the receipt keeps the
// fee the shopper saw, whatever the owner edits later.
export type OrderShipping = {
  key: string;
  label: string;
  fee: number;
  eta: string;
};

// One timeline entry (Slice 12); appended per legal transition.
export type OrderHistoryEntry = {
  status: OrderStatus;
  at: string;
};

// Receipt of the latest online payment attempt (Slice 11) — mirrors
// the backend subdoc. isPaid stays the one paid-flag.
export type OrderPayment = {
  provider: string;
  tranId: string;
  status: "initiated" | "paid" | "failed";
  failureReason?: string;
};

// One payment badge rule for every surface: text + color, never
// color alone. COD orders show a badge only once actually paid.
export const paymentBadge = (o: {
  paymentMethod?: string;
  isPaid?: boolean;
  payment?: OrderPayment;
}): { label: string; className: string } | null => {
  if (o.isPaid)
    return { label: "Paid", className: "border-green-300 bg-green-50 text-green-700" };
  if (o.paymentMethod !== "online") return null;
  if (o.payment?.status === "failed")
    return { label: "Payment failed", className: "border-red-300 bg-red-50 text-red-700" };
  return {
    label: "Awaiting payment",
    className: "border-amber-300 bg-amber-50 text-amber-700",
  };
};

export type AdminOrder = {
  _id: string;
  status: OrderStatus;
  createdAt?: string;
  totalPrice: number;
  isPaid?: boolean;
  paidAt?: string;
  discount?: OrderDiscount;
  items: OrderItem[];
  shippingAddress?: { address?: string; city?: string; phone?: string };
  paymentMethod?: string;
  user?: { _id: string; name?: string; email?: string };
};

export type OrderListResponse = PageMeta & {
  orders: AdminOrder[];
};

// One pill palette for the whole app (same hues as the shopper's
// "my orders" page).
export const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  processing: "bg-blue-100 text-blue-800 border-blue-200",
  shipped: "bg-violet-100 text-violet-800 border-violet-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

// The UI mirror of the backend state machine: the single next step for
// each status (the API also allows skips; the UI walks one step at a
// time), and where cancel is legal.
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "processing",
  processing: "shipped",
  shipped: "delivered",
};

export const CANCELLABLE: readonly OrderStatus[] = ["pending", "processing"];

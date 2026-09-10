// Shared order shapes for the admin Orders section (Slice 3).

import { PageMeta } from "./api";

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export type OrderItem = {
  product: string;
  name: string;
  price: number;
  quantity: number;
};

// A row from the admin listing: customer populated, items embedded.
// Discount snapshot stored on the order at creation (Slice 5).
export type OrderDiscount = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  amount: number;
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

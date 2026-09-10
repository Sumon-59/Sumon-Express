// Shared customer shapes for the admin Customers section (Slice 4).
// The three computed columns come from the backend's aggregation —
// the frontend only renders them.

import { PageMeta } from "./api";

export type CustomerSort = "spent" | "newest";

export type AdminCustomer = {
  _id: string;
  name: string;
  email: string;
  createdAt?: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null; // null = never ordered (kept orders only)
};

export type CustomerListResponse = PageMeta & {
  customers: AdminCustomer[];
};

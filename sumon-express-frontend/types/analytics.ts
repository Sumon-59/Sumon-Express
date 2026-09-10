// The analytics endpoint's response (Slice 6) — all server-computed.

import { OrderStatus } from "./order";

export type RevenueDay = { date: string; realized: number; pending: number };

export type AnalyticsResponse = {
  totals: {
    realizedRevenue: number;
    pendingValue: number;
    orders: number;
    customers: number;
    avgOrderValue: number;
    newCustomers30d: number;
  };
  ordersByStatus: Record<OrderStatus, number>;
  revenueByDay: RevenueDay[];
  topProducts: { productId: string; name: string; quantity: number }[];
};

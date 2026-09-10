import { Request, Response } from "express";
import { Types } from "mongoose";
import Order, { ORDER_STATUSES, OrderStatus } from "../models/Order.model";
import User from "../models/User.model";
import asyncHandler from "../utils/asyncHandler";

// The dashboard's vocabulary (Slice 6):
//   realized  = delivered orders (delivery marks paid since Slice 3)
//   pending   = money in the pipeline (pending/processing/shipped)
//   cancelled = contributes to NOTHING (except the visible churn count)
const PENDING_STATUSES: readonly OrderStatus[] = ["pending", "processing", "shipped"];

type StatusRow = { _id: OrderStatus; count: number; revenue: number };
type DayRow = { _id: string; realized: number; pending: number };
type TopProductRow = { productId: Types.ObjectId; name: string; quantity: number };

export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  // 30 UTC day-buckets ending today.
  const windowStart = new Date();
  windowStart.setUTCHours(0, 0, 0, 0);
  windowStart.setUTCDate(windowStart.getUTCDate() - 29);

  const [statusRows, dayRows, topProducts, customers, newCustomers30d] = await Promise.all([
    // One grouping feeds the tiles AND the status breakdown.
    Order.aggregate<StatusRow>([
      { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$totalPrice" } } },
    ]),
    // Daily series: bucket by CREATION date; the order's current status
    // decides which line its money feeds (history is re-read, not
    // appended — an order delivered today moves its day to realized).
    Order.aggregate<DayRow>([
      { $match: { createdAt: { $gte: windowStart }, status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          realized: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$totalPrice", 0] },
          },
          pending: {
            $sum: { $cond: [{ $in: ["$status", PENDING_STATUSES] }, "$totalPrice", 0] },
          },
        },
      },
    ]),
    // Top products from the item SNAPSHOTS — the name at sale time is
    // the honest one; renamed/deactivated products still report.
    Order.aggregate<TopProductRow>([
      { $match: { status: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.name" },
          quantity: { $sum: "$items.quantity" },
        },
      },
      { $sort: { quantity: -1, _id: 1 } }, // _id tiebreak: deterministic
      { $limit: 5 },
      { $project: { _id: 0, productId: "$_id", name: 1, quantity: 1 } },
    ]),
    User.countDocuments({ role: "user" }),
    User.countDocuments({ role: "user", createdAt: { $gte: windowStart } }),
  ]);

  const ordersByStatus = Object.fromEntries(
    ORDER_STATUSES.map((s) => [s, 0])
  ) as Record<OrderStatus, number>;
  let realizedRevenue = 0;
  let pendingValue = 0;
  let orders = 0;
  for (const row of statusRows) {
    ordersByStatus[row._id] = row.count;
    if (row._id === "delivered") realizedRevenue += row.revenue;
    if (PENDING_STATUSES.includes(row._id)) pendingValue += row.revenue;
    if (row._id !== "cancelled") orders += row.count;
  }
  const avgOrderValue = orders ? Math.floor((realizedRevenue + pendingValue) / orders) : 0;

  // A continuous 30-day calendar: empty days are zeros, never gaps —
  // the chart must show silence as silence.
  const byDay = new Map(dayRows.map((d) => [d._id, d]));
  const revenueByDay = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(windowStart);
    day.setUTCDate(day.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    const row = byDay.get(key);
    return { date: key, realized: row?.realized ?? 0, pending: row?.pending ?? 0 };
  });

  res.json({
    totals: { realizedRevenue, pendingValue, orders, customers, avgOrderValue, newCustomers30d },
    ordersByStatus,
    revenueByDay,
    topProducts,
  });
});

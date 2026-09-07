import { Request, Response } from "express";
import Order, { ORDER_STATUSES, isOrderStatus, OrderStatus } from "../models/Order.model";
import Product from "../models/Product.model";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";
import { parsePagination, pageMeta } from "../utils/pagination";

interface UpdateStatusBody {
  status?: string;
}

// The state machine (Slice 3): statuses only move FORWARD along this
// pipeline (skips allowed). "cancelled" is deliberately absent — it is
// reachable only through the cancel endpoints, the one code path that
// restores stock. Terminal states never change again.
const PIPELINE: readonly OrderStatus[] = ["pending", "processing", "shipped", "delivered"];

// Admin listing: newest first, filterable by status, paginated with the
// same {page, pages, total, ...} wrapper the products listing answers.
export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const paging = parsePagination(req);

  const filter: Record<string, unknown> = {};
  if (req.query.status !== undefined) {
    const status = String(req.query.status);
    if (!isOrderStatus(status)) {
      throw httpError(`Invalid status filter. Must be one of: ${ORDER_STATUSES.join(", ")}`, 400);
    }
    filter.status = status;
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(paging.skip)
      .limit(paging.limit),
    Order.countDocuments(filter),
  ]);

  res.json({ ...pageMeta(total, paging), orders });
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as UpdateStatusBody;

  if (!status || !isOrderStatus(status)) {
    throw httpError(`Invalid status. Must be one of: ${ORDER_STATUSES.join(", ")}`, 400);
  }

  if (status === "cancelled") {
    throw httpError(
      "Orders cannot be cancelled through the status route — use the cancel endpoint, which restores stock",
      400
    );
  }

  if (status === "pending") {
    throw httpError("Orders cannot return to pending", 400);
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    throw httpError("Order not found", 404);
  }

  if (order.status === "delivered") {
    throw httpError("Delivered orders cannot be updated", 400);
  }

  if (order.status === "cancelled") {
    throw httpError("Cancelled orders cannot be updated", 400);
  }

  if (PIPELINE.indexOf(status) <= PIPELINE.indexOf(order.status)) {
    throw httpError(
      `Orders only move forward: ${order.status} → ${status} is not a legal move`,
      400
    );
  }

  order.status = status;

  if (status === "delivered") {
    order.isPaid = true;
    order.paidAt = new Date();
  }

  await order.save();
  res.json(order);
});

export const cancelOrderByAdmin = asyncHandler(async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    throw httpError("Order not found", 404);
  }

  if (order.status === "delivered") {
    throw httpError("Delivered orders cannot be cancelled", 400);
  }

  if (order.status === "cancelled") {
    throw httpError("Order is already cancelled", 400);
  }

  if (order.status === "shipped") {
    throw httpError("Shipped orders cannot be cancelled — they can only be delivered", 400);
  }

  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { stock: item.quantity } }
    );
  }

  order.status = "cancelled";
  order.cancelledAt = new Date();
  order.cancelledBy = "admin";
  await order.save();
  res.json({ message: "Order cancelled by admin successfully" });
});

import { Request, Response } from "express";
import { Types } from "mongoose";
import Order, {
  ORDER_STATUSES,
  isOrderStatus,
  OrderStatus,
  IOrder,
} from "../models/Order.model";
import Product from "../models/Product.model";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";
import { recordStatus } from "../utils/orderStatus";
import User from "../models/User.model";
import { notifyStatusChange, notifyCancelled } from "../mail/orderEmails";
import { parsePagination, pageMeta } from "../utils/pagination";
import { restoreOrderStock } from "../utils/orderItems";

// The address lookup is a DB read like any other in these handlers —
// done inline; only the mail SEND is fire-and-forget (notify* never
// awaits delivery). A failed lookup skips the email, never the request.
const buyerEmail = async (order: Pick<IOrder, "user">): Promise<string | null> => {
  try {
    const buyer = await User.findById(order.user).select("email");
    return buyer?.email ?? null;
  } catch (err) {
    console.error("[mail] buyer lookup failed:", err);
    return null;
  }
};

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
  // user= narrows to one customer's history (the customer detail page).
  if (req.query.user !== undefined) {
    const userId = String(req.query.user);
    if (!Types.ObjectId.isValid(userId)) {
      throw httpError("Invalid user id filter", 400);
    }
    filter.user = new Types.ObjectId(userId);
  }
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

  recordStatus(order, status);

  // Delivery implies collection, for ANY method: COD collects cash at
  // the door, and delivering an unpaid ONLINE order is the admin's
  // deliberate cash-on-handover call (documented Slice 11 decision —
  // this and the verified IPN are the only two isPaid writers).
  if (status === "delivered") {
    order.isPaid = true;
    order.paidAt = new Date();
  }

  await order.save();
  const email = await buyerEmail(order);
  if (email) notifyStatusChange(order, email);
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

  // Restore stock via the shared variant-aware engine.
  await restoreOrderStock(order.items);

  recordStatus(order, "cancelled");
  order.cancelledAt = new Date();
  // "admin" here means THE STORE side (staff cancellations included —
  // the enum stays user|admin; a per-person audit trail is a later
  // concern if ever needed).
  order.cancelledBy = "admin";
  await order.save();
  const email = await buyerEmail(order);
  if (email) notifyCancelled(order, email, "admin");
  res.json({ message: "Order cancelled by admin successfully" });
});

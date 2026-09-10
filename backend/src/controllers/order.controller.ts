import { Request, Response } from "express";
import Order, { IOrderItem, IOrderDiscount } from "../models/Order.model";
import Product from "../models/Product.model";
import asyncHandler from "../utils/asyncHandler";
import { sessionUser } from "../middleware/requireAuth";
import { httpError } from "../types/http.types";
import {
  resolveDiscount,
  claimDiscountUsage,
  releaseDiscountUsage,
  ResolvedDiscount,
} from "../utils/discountRules";

import {
  buildOrderItems,
  claimItemStock,
  restoreOrderStock,
  OrderItemInput,
} from "../utils/orderItems";

interface CreateOrderBody {
  items?: OrderItemInput[];
  shippingAddress?: {
    address?: string;
    city?: string;
    phone?: string;
  };
  paymentMethod?: string;
  discountCode?: string;
}

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const user = sessionUser(req);
  const { items, shippingAddress, paymentMethod, discountCode } =
    req.body as CreateOrderBody;

  const { orderItems, subtotal } = await buildOrderItems(items);
  let totalPrice = subtotal;

  // Discount rules run BEFORE stock moves: a bad code is a cheap 400
  // with nothing to roll back. `totalPrice` so far is the subtotal.
  let resolved: ResolvedDiscount | null = null;
  let discountSnapshot: IOrderDiscount | undefined;
  if (discountCode && discountCode.trim()) {
    resolved = await resolveDiscount(discountCode, totalPrice);
    discountSnapshot = {
      code: resolved.discount.code,
      type: resolved.discount.type,
      value: resolved.discount.value,
      amount: resolved.amount,
    };
    totalPrice -= resolved.amount;
  }

  // Claim stock atomically per line (variant-aware — the shared
  // engine); roll back prior claims if any line fails.
  const decremented: IOrderItem[] = [];
  const rollbackStock = () => restoreOrderStock(decremented);
  for (const item of orderItems) {
    const claimed = await claimItemStock(item);
    if (!claimed) {
      await rollbackStock();
      throw httpError(`Insufficient stock for product: ${item.name}`, 400);
    }
    decremented.push(item);
  }

  // Claim one use of the code atomically (the guard re-checks the
  // limit, so a race for the last slot has exactly one winner).
  if (resolved) {
    const claimed = await claimDiscountUsage(resolved.discount._id);
    if (!claimed) {
      await rollbackStock();
      throw httpError("This discount code has reached its usage limit", 400);
    }
  }

  let order;
  try {
    order = await Order.create({
      user: user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod: paymentMethod || "cod",
      totalPrice,
      discount: discountSnapshot,
    });
  } catch (err) {
    // Creation failed after the side effects — undo both.
    if (resolved) await releaseDiscountUsage(resolved.discount._id);
    await rollbackStock();
    throw err;
  }

  res.status(201).json(order);
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const user = sessionUser(req);
  const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 });
  res.json({ orders });
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const user = sessionUser(req);
  const order = await Order.findById(req.params.id);

  if (!order) {
    throw httpError("Order not found", 404);
  }

  if (order.user.toString() !== user._id.toString()) {
    throw httpError("Not authorized to cancel this order", 403);
  }

  if (["shipped", "delivered"].includes(order.status)) {
    throw httpError("Order cannot be cancelled at this stage", 400);
  }

  if (order.status === "cancelled") {
    throw httpError("Order is already cancelled", 400);
  }

  // Restore stock via the shared variant-aware engine.
  await restoreOrderStock(order.items);

  order.status = "cancelled";
  order.cancelledAt = new Date();
  order.cancelledBy = "user";
  await order.save();

  res.json({ message: "Order cancelled successfully" });
});

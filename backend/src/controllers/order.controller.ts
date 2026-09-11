import { Request, Response } from "express";
import Order, { IOrderItem, IOrderDiscount, IOrderShipping } from "../models/Order.model";
import { readStoreSettings } from "./settings.controller";
import { recordStatus } from "../utils/orderStatus";
import { notifyOrderPlaced, notifyCancelled } from "../mail/orderEmails";
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
  shippingMethod?: string;
}

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const user = sessionUser(req);
  const { items, shippingAddress, paymentMethod, discountCode, shippingMethod } =
    req.body as CreateOrderBody;

  // NEW orders take exactly two methods (Slice 11): cod or online (the
  // gateway serves every instrument behind one door). The schema enum
  // keeps legacy values only so OLD documents stay readable. Checked
  // first — cheap validation before any side effect.
  const method = paymentMethod ?? "cod";
  if (method !== "cod" && method !== "online") {
    throw httpError("Payment method must be cod or online", 400);
  }

  // Shipping is resolved from settings AT order time and SNAPSHOTTED
  // (Slice 12): the fee the shopper saw is the fee the receipt keeps,
  // whatever the owner edits later. Refused BEFORE any side effect.
  const settings = await readStoreSettings();
  // Keys are stored trimmed+lowercased — normalize the input the same
  // way so "Inside-Dhaka" matches what validation stored.
  const wantedKey = String(shippingMethod ?? "").trim().toLowerCase();
  const chosenShipping = settings.shippingMethods.find((m) => m.key === wantedKey);
  if (!chosenShipping) {
    throw httpError("Choose a valid shipping method", 400);
  }
  const shippingSnapshot: IOrderShipping = {
    key: chosenShipping.key,
    label: chosenShipping.label,
    fee: chosenShipping.fee,
    eta: chosenShipping.eta,
  };

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

  // The fee joins AFTER discounting: discounts price the GOODS (their
  // minimums and caps never see shipping); the fee is added on top.
  totalPrice += shippingSnapshot.fee;

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
    order = new Order({
      user: user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod: method,
      shipping: shippingSnapshot,
      totalPrice,
      discount: discountSnapshot,
    });
    // The timeline starts through the same door every transition uses.
    recordStatus(order, "pending");
    await order.save();
  } catch (err) {
    // Creation failed after the side effects — undo both.
    if (resolved) await releaseDiscountUsage(resolved.discount._id);
    await rollbackStock();
    throw err;
  }

  // Fire-and-forget (Slice 13): the receipt email rides the session
  // user's address; delivery is never awaited, failure never thrown.
  notifyOrderPlaced(order, user.email);

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

  recordStatus(order, "cancelled");
  order.cancelledAt = new Date();
  order.cancelledBy = "user";
  await order.save();
  notifyCancelled(order, user.email, "user");

  res.json({ message: "Order cancelled successfully" });
});

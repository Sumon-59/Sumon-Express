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

interface OrderItemInput {
  product: string;
  quantity: number;
}

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

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw httpError("Order must contain at least one item", 400);
  }

  const productIds = [...new Set(items.map((i) => String(i.product)))];
  if (productIds.length !== items.length) {
    throw httpError("Duplicate products in order items", 400);
  }

  const products = await Product.find({ _id: { $in: productIds }, isActive: true });

  if (products.length !== productIds.length) {
    throw httpError("One or more products not found", 404);
  }

  let totalPrice = 0;

  const orderItems: IOrderItem[] = items.map((i) => {
    const p = products.find((x) => x._id.toString() === i.product);

    if (!p) {
      throw httpError(`Product not found: ${i.product}`, 404);
    }

    const quantity = Number(i.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw httpError(`Invalid quantity for product: ${p.name}`, 400);
    }

    if (p.stock < quantity) {
      throw httpError(`Insufficient stock for product: ${p.name}`, 400);
    }

    const unitPrice = p.discountPrice ?? p.price;

    totalPrice += unitPrice * quantity;

    return {
      product: p._id,
      name: p.name,
      price: unitPrice,
      quantity,
    };
  });

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

  // Decrement stock atomically; roll back prior decrements if any item fails
  const decremented: IOrderItem[] = [];
  const rollbackStock = async () => {
    for (const done of decremented) {
      await Product.updateOne({ _id: done.product }, { $inc: { stock: done.quantity } });
    }
  };
  for (const item of orderItems) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true }
    );

    if (!updated) {
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

  // Rollback stock from saved items
  for (const item of order.items) {
    await Product.updateOne(
      { _id: item.product },
      { $inc: { stock: item.quantity } }
    );
  }

  order.status = "cancelled";
  order.cancelledAt = new Date();
  order.cancelledBy = "user";
  await order.save();

  res.json({ message: "Order cancelled successfully" });
});

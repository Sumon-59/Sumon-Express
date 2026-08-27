import { Request, Response } from "express";
import Order, { IOrderItem } from "../models/Order.model";
import Product from "../models/Product.model";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";

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
}

// Cookie-auth routes attach a SessionUser; narrow req.user before use.
const requireSessionUser = (req: Request) => {
  const user = req.user;
  if (!user || typeof user === "string") {
    throw httpError("Unauthorized", 401);
  }
  return user;
};

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const sessionUser = requireSessionUser(req);
  const { items, shippingAddress, paymentMethod } = req.body as CreateOrderBody;

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

  // Decrement stock atomically; roll back prior decrements if any item fails
  const decremented: IOrderItem[] = [];
  for (const item of orderItems) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.product, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true }
    );

    if (!updated) {
      for (const done of decremented) {
        await Product.updateOne(
          { _id: done.product },
          { $inc: { stock: done.quantity } }
        );
      }
      throw httpError(`Insufficient stock for product: ${item.name}`, 400);
    }

    decremented.push(item);
  }

  const order = await Order.create({
    user: sessionUser._id,
    items: orderItems,
    shippingAddress,
    paymentMethod: paymentMethod || "cod",
    totalPrice,
  });

  res.status(201).json(order);
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const sessionUser = requireSessionUser(req);
  const orders = await Order.find({ user: sessionUser._id }).sort({ createdAt: -1 });
  res.json({ orders });
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const sessionUser = requireSessionUser(req);
  const order = await Order.findById(req.params.id);

  if (!order) {
    throw httpError("Order not found", 404);
  }

  if (order.user.toString() !== sessionUser._id.toString()) {
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

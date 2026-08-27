import { Request, Response } from "express";
import Order, { ORDER_STATUSES, isOrderStatus } from "../models/Order.model";
import Product from "../models/Product.model";
import asyncHandler from "../utils/asyncHandler";
import { httpError } from "../types/http.types";

interface UpdateStatusBody {
  status?: string;
}

export const getAllOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await Order.find()
    .populate("user", "name email")
    .sort({ createdAt: -1 });
  res.json(orders);
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as UpdateStatusBody;

  if (!status || !isOrderStatus(status)) {
    throw httpError(`Invalid status. Must be one of: ${ORDER_STATUSES.join(", ")}`, 400);
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

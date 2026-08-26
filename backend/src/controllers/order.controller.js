const Order = require("../models/Order.model");
const Product = require("../models/Product.model");
const asyncHandler = require("../utils/asyncHandler");

const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethod } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    const error = new Error("Order must contain at least one item");
    error.statusCode = 400;
    throw error;
  }

  const productIds = [...new Set(items.map((i) => String(i.product)))];
  if (productIds.length !== items.length) {
    const error = new Error("Duplicate products in order items");
    error.statusCode = 400;
    throw error;
  }

  const products = await Product.find({ _id: { $in: productIds }, isActive: true });

  if (products.length !== productIds.length) {
    const error = new Error("One or more products not found");
    error.statusCode = 404;
    throw error;
  }

  let totalPrice = 0;

  const orderItems = items.map((i) => {
    const p = products.find((x) => x._id.toString() === i.product);

    if (!p) {
      const error = new Error(`Product not found: ${i.product}`);
      error.statusCode = 404;
      throw error;
    }

    const quantity = Number(i.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      const error = new Error(`Invalid quantity for product: ${p.name}`);
      error.statusCode = 400;
      throw error;
    }

    if (p.stock < quantity) {
      const error = new Error(`Insufficient stock for product: ${p.name}`);
      error.statusCode = 400;
      throw error;
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
  const decremented = [];
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
      const error = new Error(`Insufficient stock for product: ${item.name}`);
      error.statusCode = 400;
      throw error;
    }

    decremented.push(item);
  }

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    shippingAddress,
    paymentMethod: paymentMethod || "cod",
    totalPrice, // ✅ matches Order model requirement
  });

  res.status(201).json(order);
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ orders });
});

const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  if (order.user.toString() !== req.user._id.toString()) {
    const error = new Error("Not authorized to cancel this order");
    error.statusCode = 403;
    throw error;
  }

  if (["shipped", "delivered"].includes(order.status)) {
    const error = new Error("Order cannot be cancelled at this stage");
    error.statusCode = 400;
    throw error;
  }

  if (order.status === "cancelled") {
    const error = new Error("Order is already cancelled");
    error.statusCode = 400;
    throw error;
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

module.exports = {
  createOrder,
  getMyOrders,
  cancelOrder,
};

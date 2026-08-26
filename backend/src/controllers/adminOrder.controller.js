const Order  = require("../models/Order.model");
const Product = require("../models/Product.model");
const asyncHandler = require("../utils/asyncHandler");

const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];

const getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find()
        .populate("user", "name email")
        .sort({ createdAt: -1 });
    res.json(orders);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!ORDER_STATUSES.includes(status)) {
        const error = new Error(`Invalid status. Must be one of: ${ORDER_STATUSES.join(", ")}`);
        error.statusCode = 400;
        throw error;
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
    }

    if (order.status === "delivered") {
        const error = new Error("Delivered orders cannot be updated");
        error.statusCode = 400;
        throw error;
    }

    if (order.status === "cancelled") {
        const error = new Error("Cancelled orders cannot be updated");
        error.statusCode = 400;
        throw error;
    }

    order.status = status;

    if (status === "delivered") {
        order.isPaid = true;
        order.paidAt = Date.now();
    }

    await order.save();
    res.json(order);
});

const cancelOrderByAdmin = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
    }

    if (order.status === "delivered") {
        const error = new Error("Delivered orders cannot be cancelled");
        error.statusCode = 400;
        throw error;
    }

    if (order.status === "cancelled") {
        const error = new Error("Order is already cancelled");
        error.statusCode = 400;
        throw error;
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

module.exports = {
    getAllOrders,
    updateOrderStatus,
    cancelOrderByAdmin,
};
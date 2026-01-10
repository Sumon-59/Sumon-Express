const Order  = require("../models/Order.model");
const asyncHandler = require("../utils/asyncHandler");

const getAllOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find()
        .populate("user", "name email")
        .sort({ createdAt: -1 });
    res.json(orders);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
    }

    if (order.status === "delivered") {
        throw new Error("Delivered orders cannot be updated");
    }

    if (order.status === "cancelled") {
        throw new Error("Cancelled orders cannot be updated");
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
        throw new Error("Delivered orders cannot be cancelled");
    }

    if (order.status === "cancelled") {
        throw new Error("Order is already cancelled");
    }

    for (const item of order.orderItems) {
        const product = await Product.findById(item.product);
        if (product) {
            product.stock += item.quantity;
            await product.save();
        }
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
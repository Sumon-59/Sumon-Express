const Order = require("../models/order.model");
const Product = require("../models/Product.model");
const asyncHandler = require("../utils/asyncHandler");

const createOrder = asyncHandler(async (req, res) => {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || !Array.isArray(items) ||items.length === 0) {
        const error = new Error("Order must contain at least one item");
        error.statusCode = 400;
        throw error;
    }

    const productIds = items.map((i) => i.product);
    const products = await Product.find({ _id: { $in: productIds }, isActive: true });

    if (products.length !== productIds.length) {
        const error = new Error("One or more products not found");
        error.statusCode = 404;
        throw error;
    }

    let totalAmount = 0;
    const orderItems = items.map((i) => {
        const p = products.find((x) => x._id.toString() === i.product);

        if (!p) {
            const error = new Error(`Product not found: ${i.product}`);
            error.statusCode = 404;
            throw error;
        }

        if (p.stock < i.quantity) {
            const error = new Error(`Insufficient stock for product: ${p.name}`);
            error.statusCode = 400;
            throw error;
        }

        const unitPrice = p.discountPrice ?? p.price;
        totalAmount += unitPrice * i.quantity;

        return {
            product: p._id,
            name: p.name,
            price: unitPrice,
            quantity: i.quantity,
        };
    });

    for(const i of items) {
        const p = products.find((x) => x._id.toString() === i.product);
        p.stock -= i.quantity;
        await p.save();
    }

    const order = await Order.create({
        user: req.user._id,
        items: orderItems,
        shippingAddress,
        paymentMethod: paymentMethod || "cod",
        totalAmount,
    });

    res.status(201).json(order);
});

const getMyOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user }).sort({ createdAt: -1 });
    res.json(orders);
});

const cancelOrder = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
    }

    if(order.user.toString() !== req.user._id.toString()) {
        const error = new Error("Not authorized to cancel this order");
        error.statusCode = 403;
        throw error;
    }

    if (["shipped", "delivered"].includes(order.status)) {
        throw new Error("Order cannot be cancelled at this stage");
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
    order.cancelledBy = "user";
    await order.save();
    res.json({ message: "Order cancelled successfully" });
});

module.exports = {
    createOrder,
    getMyOrders,
    cancelOrder,
};


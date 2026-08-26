const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, default: 1 },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        items: {
            type: [orderItemSchema],
            required: true,
        },

        totalPrice: {
            type: Number,
            required: true,
        },

        shippingAddress: {
            address: { type: String },
            city: { type: String },
            phone: { type: String },
        },

        paymentMethod: {
            type: String,
            enum: ["cod", "bkash", "nagad", "rocket", "card"],
            default: "cod",
        },
        
        status: {
            type: String,
            enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
            default: "pending",
        },

        isPaid: {
            type: Boolean,
            default: false,
        },

        paidAt: Date,
        cancelledAt: Date,
        cancelledBy: {
            type: String,
            enum: ["user", "admin"],
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
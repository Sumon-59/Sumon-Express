const express = require("express");
const router = express.Router();

const { protectCookie } = require("../middleware/authCookie.middleware");
const { createOrder, getMyOrders, cancelOrder } = require("../controllers/order.controller");

// Cookie-based protected routes
router.post("/", protectCookie, createOrder);
router.get("/my-orders", protectCookie, getMyOrders);
router.put("/:id/cancel", protectCookie, cancelOrder);

module.exports = router;

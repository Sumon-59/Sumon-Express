const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const { cancelOrder } = require("../controllers/order.controller");
const { createOrder, getMyOrders } = require("../controllers/order.controller");

router.post("/", protect, createOrder);
router.get("/my-orders", protect, getMyOrders);
router.put("/:id/cancel", protect, cancelOrder);

module.exports = router;
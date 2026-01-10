const express = require("express");
const router = express.Router();

const protect = require("../middleware/auth.middleware");
const isAdmin = require("../middleware/admin.middleware");

// admin order controllers
const {
  getAllOrders,
  updateOrderStatus,
} = require("../controllers/adminOrder.controller");

// admin dashboard test route
router.get("/dashboard", protect, isAdmin, (req, res) => {
  res.json({ message: "Welcome to Admin Dashboard" });
});

// admin: get all orders
router.get("/orders", protect, isAdmin, getAllOrders);

// admin: update order status
router.put("/orders/:id", protect, isAdmin, updateOrderStatus);
router.put("/orders/:id/cancel", protect, isAdmin, cancelOrderByAdmin);

module.exports = router;

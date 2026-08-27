import express from "express";

import protect from "../middleware/auth.middleware";
import isAdmin from "../middleware/admin.middleware";

// admin order controllers
import {
  getAllOrders,
  updateOrderStatus,
  cancelOrderByAdmin,
} from "../controllers/adminOrder.controller";

const router = express.Router();

// admin dashboard test route
router.get("/dashboard", protect, isAdmin, (req, res) => {
  res.json({ message: "Welcome to Admin Dashboard" });
});

// admin: get all orders
router.get("/orders", protect, isAdmin, getAllOrders);

// admin: update order status
router.put("/orders/:id", protect, isAdmin, updateOrderStatus);
router.put("/orders/:id/cancel", protect, isAdmin, cancelOrderByAdmin);

export = router;

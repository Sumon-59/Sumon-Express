import express from "express";

import { requireAuth, requireAdmin } from "../middleware/requireAuth";

// admin order controllers
import {
  getAllOrders,
  updateOrderStatus,
  cancelOrderByAdmin,
} from "../controllers/adminOrder.controller";
import { getAdminProducts } from "../controllers/product.controller";

const router = express.Router();

// admin dashboard test route
router.get("/dashboard", requireAuth, requireAdmin, (req, res) => {
  res.json({ message: "Welcome to Admin Dashboard" });
});

// admin: full catalog (all statuses, search, status filter, pagination)
router.get("/products", requireAuth, requireAdmin, getAdminProducts);

// admin: get all orders
router.get("/orders", requireAuth, requireAdmin, getAllOrders);

// admin: update order status
router.put("/orders/:id", requireAuth, requireAdmin, updateOrderStatus);
router.put("/orders/:id/cancel", requireAuth, requireAdmin, cancelOrderByAdmin);

export default router;

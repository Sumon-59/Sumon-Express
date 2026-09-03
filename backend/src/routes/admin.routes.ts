import express from "express";

import { requireAuth, requireAdmin } from "../middleware/requireAuth";

// admin order controllers
import {
  getAllOrders,
  updateOrderStatus,
  cancelOrderByAdmin,
} from "../controllers/adminOrder.controller";
import { getAdminProducts, getAdminProductById } from "../controllers/product.controller";
import { getUploadSignature } from "../controllers/upload.controller";

const router = express.Router();

// admin dashboard test route
router.get("/dashboard", requireAuth, requireAdmin, (req, res) => {
  res.json({ message: "Welcome to Admin Dashboard" });
});

// admin: full catalog (all statuses, search, status filter, pagination)
router.get("/products", requireAuth, requireAdmin, getAdminProducts);
router.get("/products/:id", requireAuth, requireAdmin, getAdminProductById);

// admin: sign a Cloudinary direct upload (Slice 2b)
router.post("/uploads/signature", requireAuth, requireAdmin, getUploadSignature);

// admin: get all orders
router.get("/orders", requireAuth, requireAdmin, getAllOrders);

// admin: update order status
router.put("/orders/:id", requireAuth, requireAdmin, updateOrderStatus);
router.put("/orders/:id/cancel", requireAuth, requireAdmin, cancelOrderByAdmin);

export default router;

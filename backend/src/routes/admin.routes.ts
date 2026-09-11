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
import { getCustomers, getCustomerById } from "../controllers/adminCustomer.controller";
import { getAnalytics } from "../controllers/adminAnalytics.controller";
import {
  getAdminDiscounts,
  getAdminDiscountById,
  createDiscount,
  updateDiscount,
} from "../controllers/discount.controller";
import { updateSettings } from "../controllers/settings.controller";
import { getMailStatus } from "../controllers/mailStatus.controller";

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

// admin: the dashboard numbers (Slice 6)
router.get("/analytics", requireAuth, requireAdmin, getAnalytics);

// admin: the customer census (Slice 4)
router.get("/customers", requireAuth, requireAdmin, getCustomers);
router.get("/customers/:id", requireAuth, requireAdmin, getCustomerById);

// admin: discount codes (Slice 5) — no hard delete; deactivate via update
router.get("/discounts", requireAuth, requireAdmin, getAdminDiscounts);
router.get("/discounts/:id", requireAuth, requireAdmin, getAdminDiscountById);
router.post("/discounts", requireAuth, requireAdmin, createDiscount);
router.put("/discounts/:id", requireAuth, requireAdmin, updateDiscount);

// admin: store settings (Slice 10) — the public read lives at /api/settings
router.put("/settings", requireAuth, requireAdmin, updateSettings);

// admin: which mailer is the runtime actually using (Slice 13 probe seam)
router.get("/mail-status", requireAuth, requireAdmin, getMailStatus);

// admin: get all orders
router.get("/orders", requireAuth, requireAdmin, getAllOrders);

// admin: update order status
router.put("/orders/:id", requireAuth, requireAdmin, updateOrderStatus);
router.put("/orders/:id/cancel", requireAuth, requireAdmin, cancelOrderByAdmin);

export default router;

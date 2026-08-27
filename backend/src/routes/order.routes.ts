import express from "express";

import { requireAuth } from "../middleware/requireAuth";
import {
  createOrder,
  getMyOrders,
  cancelOrder,
} from "../controllers/order.controller";

const router = express.Router();

// Cookie-based protected routes
router.post("/", requireAuth, createOrder);
router.get("/my-orders", requireAuth, getMyOrders);
router.put("/:id/cancel", requireAuth, cancelOrder);

export = router;

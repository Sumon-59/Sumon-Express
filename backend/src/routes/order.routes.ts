import express from "express";

import { requireAuth } from "../middleware/requireAuth";
import {
  createOrder,
  getMyOrders,
  cancelOrder,
} from "../controllers/order.controller";

const router = express.Router();

// Bearer-protected routes (unified auth, Slice 1)
router.post("/", requireAuth, createOrder);
router.get("/my-orders", requireAuth, getMyOrders);
router.put("/:id/cancel", requireAuth, cancelOrder);

export default router;

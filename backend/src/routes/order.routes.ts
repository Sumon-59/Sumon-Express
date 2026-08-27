import express from "express";

import { protectCookie } from "../middleware/authCookie.middleware";
import {
  createOrder,
  getMyOrders,
  cancelOrder,
} from "../controllers/order.controller";

const router = express.Router();

// Cookie-based protected routes
router.post("/", protectCookie, createOrder);
router.get("/my-orders", protectCookie, getMyOrders);
router.put("/:id/cancel", protectCookie, cancelOrder);

export = router;

import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { previewDiscount } from "../controllers/discount.controller";

const router = express.Router();

// Shopper-facing: "what would this code do to this cart?" —
// authenticated (checkout requires login anyway), consumes nothing.
router.post("/preview", requireAuth, previewDiscount);

export default router;

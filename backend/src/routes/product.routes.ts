import express from "express";

import { requireAuth, requireAdmin } from "../middleware/requireAuth";

import {
  createProduct,
  getProductById,
  getRelatedProducts,
  getProducts,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller";
import {
  getProductReviews,
  getReviewEligibility,
  createReview,
} from "../controllers/review.controller";

const router = express.Router();

// reviews (Slice 9) and related BEFORE the catch-all detail route
router.get("/:id/reviews", getProductReviews);
router.get("/:id/reviews/eligibility", requireAuth, getReviewEligibility);
router.post("/:id/reviews", requireAuth, createReview);
// related strip
router.get("/:id/related", getRelatedProducts);
router.get("/:id", getProductById);
router.get("/", getProducts);

router.post("/", requireAuth, requireAdmin, createProduct);
router.put("/:id", requireAuth, requireAdmin, updateProduct);
router.delete("/:id", requireAuth, requireAdmin, deleteProduct);

export default router;

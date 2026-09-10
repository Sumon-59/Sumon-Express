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

const router = express.Router();

// related BEFORE the catch-all detail route
router.get("/:id/related", getRelatedProducts);
router.get("/:id", getProductById);
router.get("/", getProducts);

router.post("/", requireAuth, requireAdmin, createProduct);
router.put("/:id", requireAuth, requireAdmin, updateProduct);
router.delete("/:id", requireAuth, requireAdmin, deleteProduct);

export default router;

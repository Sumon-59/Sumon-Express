import express from "express";

import { requireAuth, requireAdmin } from "../middleware/requireAuth";

import {
  createProduct,
  getProductById,
  getProducts,
  //updateProduct,
  //deleteProduct,
} from "../controllers/product.controller";

const router = express.Router();

router.get("/:id", getProductById);
router.get("/", getProducts);

router.post("/", requireAuth, requireAdmin, createProduct);
//router.put("/:id", requireAuth, requireAdmin, updateProduct);
//router.delete("/:id", requireAuth, requireAdmin, deleteProduct);

export = router;

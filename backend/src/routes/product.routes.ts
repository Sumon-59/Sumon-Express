import express from "express";

import protect from "../middleware/auth.middleware";
import isAdmin from "../middleware/admin.middleware";

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

router.post("/", protect, isAdmin, createProduct);
//router.put("/:id", protect, isAdmin, updateProduct);
//router.delete("/:id", protect, isAdmin, deleteProduct);

export = router;

import express from "express";

import {
  createCategory,
  getCategories,
  updateCategory,
} from "../controllers/category.controller";

import protect from "../middleware/auth.middleware";
import isAdmin from "../middleware/admin.middleware";

const router = express.Router();

router.get("/", getCategories);

router.post("/", protect, isAdmin, createCategory);
router.put("/:id", protect, isAdmin, updateCategory);

export = router;

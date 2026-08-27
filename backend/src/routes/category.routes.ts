import express from "express";

import {
  createCategory,
  getCategories,
  updateCategory,
} from "../controllers/category.controller";

import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = express.Router();

router.get("/", getCategories);

router.post("/", requireAuth, requireAdmin, createCategory);
router.put("/:id", requireAuth, requireAdmin, updateCategory);

export default router;

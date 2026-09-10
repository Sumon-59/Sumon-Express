import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { updateReview, deleteReview } from "../controllers/review.controller";

const router = express.Router();

// Owner-only edits — ownership is checked in the controller.
router.put("/:id", requireAuth, updateReview);
router.delete("/:id", requireAuth, deleteReview);

export default router;

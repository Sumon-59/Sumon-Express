import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getProfile } from "../controllers/user.controller";

const router = express.Router();

router.get("/profile", requireAuth, getProfile);

export = router;

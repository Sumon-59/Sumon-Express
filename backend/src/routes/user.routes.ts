import express from "express";
import protect from "../middleware/auth.middleware";
import { getProfile } from "../controllers/user.controller";

const router = express.Router();

router.get("/profile", protect, getProfile);

export = router;

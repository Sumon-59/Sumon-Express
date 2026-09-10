import express from "express";
import { getSettings } from "../controllers/settings.controller";

const router = express.Router();

// Public by design: the navbar renders for anonymous shoppers — gating
// the brand behind auth would blank it exactly where it matters most.
router.get("/", getSettings);

export default router;
